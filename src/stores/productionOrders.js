import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { productionOrders as seedFromMock } from '@/mock/data'

const STORAGE_KEY = 'nf_erp_proto_production_orders'
const SCHEMA_KEY = 'nf_erp_proto_orders_schema'
const SCHEMA_VER = '3'

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function newRemarkId() {
  return `re-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function newLineId() {
  return `ln-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** 将旧版 string remark 迁成 remarkEntries */
/** 旧版「待审核」取消；旧称「执行中」统一为「生产中」 */
function migrateOrderStatus(o) {
  if (!o || typeof o !== 'object') return
  if (o.status === '待审核' || o.status === '执行中') o.status = '生产中'
}

/** 订单明细行补全单位名称（旧数据无 unit） */
function migrateOrderLines(o) {
  if (!o?.lines || !Array.isArray(o.lines)) return
  for (const line of o.lines) {
    if (line == null || typeof line !== 'object') continue
    if (line.unit == null || String(line.unit).trim() === '') line.unit = '—'
  }
}

/** 明细行备注：由单条 string note 迁为可追加的 noteRemarkEntries */
function migrateLineRemarks(o) {
  if (!o?.lines || !Array.isArray(o.lines)) return
  const owner = (o.owner || '—').trim() || '—'
  const createdAt = o.signedAt || todayStr()
  for (const line of o.lines) {
    if (line == null || typeof line !== 'object') continue
    if (!line.lineId) line.lineId = newLineId()
    if (Array.isArray(line.noteRemarkEntries)) {
      for (const e of line.noteRemarkEntries) {
        if (typeof e.done !== 'boolean') e.done = false
      }
      continue
    }
    const legacy = typeof line.note === 'string' ? line.note.trim() : ''
    line.noteRemarkEntries = legacy
      ? [
          {
            id: newRemarkId(),
            text: legacy,
            priority: 'normal',
            createdAt,
            createdBy: owner,
            done: false,
          },
        ]
      : []
  }
}

function migrateRemarkEntries(o) {
  if (!o || typeof o !== 'object') return
  if (Array.isArray(o.remarkEntries)) return
  const legacy = typeof o.remark === 'string' ? o.remark.trim() : ''
  o.remarkEntries = legacy
    ? [
        {
          id: newRemarkId(),
          text: legacy,
          priority: 'normal',
          createdAt: o.signedAt || todayStr(),
          createdBy: (o.owner || '—').trim() || '—',
          done: false,
        },
      ]
    : []
  delete o.remark
}

function migrateRemarkDone(o) {
  if (!o || typeof o !== 'object') return
  if (Array.isArray(o.remarkEntries)) {
    for (const e of o.remarkEntries) {
      if (typeof e.done !== 'boolean') e.done = false
    }
  }
  if (Array.isArray(o.lines)) {
    for (const line of o.lines) {
      if (!Array.isArray(line?.noteRemarkEntries)) continue
      for (const e of line.noteRemarkEntries) {
        if (typeof e.done !== 'boolean') e.done = false
      }
    }
  }
}

function migrateShippingApproval(o) {
  if (!o || typeof o !== 'object') return
  if (typeof o.shipReleaseApproved !== 'boolean') {
    const raw = o.shipReleaseApproved
    if (typeof raw === 'string') {
      const v = raw.trim().toLowerCase()
      o.shipReleaseApproved = ['true', '1', 'yes', 'ok', 'approved', '同意', '已同意', '通过', '已通过'].includes(v)
    } else if (typeof raw === 'number') {
      o.shipReleaseApproved = raw > 0
    } else {
      // 兼容旧数据：若已在“待出货”，视作已放行
      o.shipReleaseApproved = o.status === '待出货'
    }
  }
  if (typeof o.shipReleaseBy !== 'string') o.shipReleaseBy = ''
  if (o.shipReleaseApproved && !o.shipReleaseBy) o.shipReleaseBy = '—'
}

function migrateShipmentRecords(o) {
  if (!o || typeof o !== 'object') return
  if (!Array.isArray(o.shipments)) o.shipments = []
  let seq = Number(o.shipmentSeq) || 0
  let shippedByLogs = 0
  for (const s of o.shipments) {
    if (!s || typeof s !== 'object') continue
    s.id = String(s.id || '').trim() || ''
    s.date = String(s.date || todayStr()).trim() || todayStr()
    s.qty = Math.max(0, Number(s.qty) || 0)
    s.manager = String(s.manager || s.by || '').trim() || '—'
    s.tracking = String(s.tracking || '').trim()
    s.note = String(s.note || '').trim()
    shippedByLogs += s.qty
    if (s.id.startsWith('SH-')) {
      const tail = Number(String(s.id).split('-').pop())
      if (!Number.isNaN(tail)) seq = Math.max(seq, tail)
    }
  }
  o.shipmentSeq = seq
  if (typeof o.shippedQty !== 'number') o.shippedQty = 0
  if (!o.shippedQty && shippedByLogs > 0) {
    o.shippedQty = Math.min(Number(o.totalQty) || 0, shippedByLogs)
  }
}

/** 旧版「待出货」但未放行 → 待出货审批，由厂长审批后再进入待出货 */
function migrateShipPendingApproval(o) {
  if (!o || typeof o !== 'object') return
  if (o.status === '待出货' && o.shipReleaseApproved === false) o.status = '待出货审批'
}

function buildInitialRemarkEntries(payload) {
  const text = (payload.remark || '').trim()
  if (!text) return []
  return [
    {
      id: newRemarkId(),
      text,
      priority: 'normal',
      createdAt: payload.signedAt || todayStr(),
      createdBy: (payload.owner || '徐总').trim() || '徐总',
    },
  ]
}

function loadInitial() {
  if (localStorage.getItem(SCHEMA_KEY) !== SCHEMA_VER) {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.setItem(SCHEMA_KEY, SCHEMA_VER)
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length) {
        parsed.forEach((o) => {
          migrateOrderStatus(o)
          migrateRemarkEntries(o)
          migrateOrderLines(o)
          migrateLineRemarks(o)
          migrateRemarkDone(o)
          migrateShippingApproval(o)
          migrateShipmentRecords(o)
          migrateShipPendingApproval(o)
        })
        return parsed
      }
    }
  } catch {
    /* ignore */
  }
  const seed = clone(seedFromMock)
  seed.forEach((o) => {
    migrateOrderStatus(o)
    migrateRemarkEntries(o)
    migrateOrderLines(o)
    migrateLineRemarks(o)
    migrateRemarkDone(o)
    migrateShippingApproval(o)
    migrateShipmentRecords(o)
    migrateShipPendingApproval(o)
  })
  return seed
}

/** 单号规则：MO-年-月日四位-三位流水，与种子数据格式一致 */
function nextOrderId(existing) {
  const d = new Date()
  const y = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const mmdd = `${mm}${dd}`
  const prefix = `MO-${y}-${mmdd}-`
  let maxSeq = 0
  for (const o of existing) {
    if (o.id?.startsWith(prefix)) {
      const s = parseInt(o.id.slice(prefix.length), 10)
      if (!Number.isNaN(s)) maxSeq = Math.max(maxSeq, s)
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`
}

export const useProductionOrderStore = defineStore('productionOrders', () => {
  const orders = ref(loadInitial())

  watch(
    orders,
    (v) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
      } catch {
        /* ignore */
      }
    },
    { deep: true },
  )

  /**
   * @param {object} payload
   * @param {string} payload.customer
   * @param {string} [payload.customerType]
   * @param {string} payload.signedAt
   * @param {string} payload.dueDate
   * @param {string} [payload.owner]
   * @param {string} [payload.remark]
   * @param {boolean} [payload.allowPartialShip]
   * @param {number} [payload.contractAmount]
   * @param {number} [payload.receivedAmount]
   * @param {Array} payload.lines { unit, model, temp, stitch, qty, punch, note }（stitch 存缝包）
   */
  /** 详情页状态推进（下发、设计、备货、生产、出货审批等） */
  function setOrderStatus(id, status) {
    const o = orders.value.find((x) => x.id === id)
    if (o) o.status = status
  }

  /** 追加主信息备注（不覆盖历史） */
  function appendRemark(orderId, { text, priority, by }) {
    const o = orders.value.find((x) => x.id === orderId)
    if (!o) return
    migrateRemarkEntries(o)
    const t = String(text || '').trim()
    if (!t) return
    const pr = priority === 'high' ? 'high' : 'normal'
    o.remarkEntries.push({
      id: newRemarkId(),
      text: t,
      priority: pr,
      createdAt: todayStr(),
      createdBy: String(by || '—').trim() || '—',
      done: false,
    })
  }

  function toggleRemarkDone(orderId, remarkId, done) {
    const o = orders.value.find((x) => x.id === orderId)
    if (!o) return false
    migrateRemarkEntries(o)
    migrateRemarkDone(o)
    const e = o.remarkEntries.find((x) => x.id === remarkId)
    if (!e) return false
    e.done = !!done
    return true
  }

  /** 订单明细行追加备注（按 lineId 定位行） */
  /** 确保明细行具备 lineId 与 noteRemarkEntries（打开详情时调用即可） */
  function touchLineStructure(orderId) {
    const o = orders.value.find((x) => x.id === orderId)
    if (!o) return
    migrateLineRemarks(o)
  }

  function appendLineRemark(orderId, lineId, { text, priority, by }) {
    const o = orders.value.find((x) => x.id === orderId)
    if (!o) return false
    migrateLineRemarks(o)
    const line = o.lines.find((l) => l.lineId === lineId)
    if (!line) return false
    const t = String(text || '').trim()
    if (!t) return false
    const pr = priority === 'high' ? 'high' : 'normal'
    if (!Array.isArray(line.noteRemarkEntries)) line.noteRemarkEntries = []
    line.noteRemarkEntries.push({
      id: newRemarkId(),
      text: t,
      priority: pr,
      createdAt: todayStr(),
      createdBy: String(by || '—').trim() || '—',
      done: false,
    })
    line.note = line.noteRemarkEntries.map((e) => e.text).join('；')
    return true
  }

  function toggleLineRemarkDone(orderId, lineId, remarkId, done) {
    const o = orders.value.find((x) => x.id === orderId)
    if (!o) return false
    migrateLineRemarks(o)
    migrateRemarkDone(o)
    const line = o.lines.find((l) => l.lineId === lineId)
    if (!line || !Array.isArray(line.noteRemarkEntries)) return false
    const e = line.noteRemarkEntries.find((x) => x.id === remarkId)
    if (!e) return false
    e.done = !!done
    return true
  }

  function setShipRelease(orderId, approved, by) {
    const o = orders.value.find((x) => x.id === orderId)
    if (!o) return
    o.shipReleaseApproved = !!approved
    o.shipReleaseBy = approved ? (String(by || '').trim() || '—') : ''
  }

  function recordShipment(orderId, payload) {
    const o = orders.value.find((x) => x.id === orderId)
    if (!o) return { ok: false, message: '未找到订单' }
    migrateShipmentRecords(o)
    const reqQty = Math.max(0, Number(typeof payload === 'object' ? payload?.qty : payload) || 0)
    if (!reqQty) return { ok: false, message: '出货数量必须大于 0' }
    const total = Math.max(0, Number(o.totalQty) || 0)
    const shipped = Math.max(0, Number(o.shippedQty) || 0)
    const remaining = Math.max(0, total - shipped)
    if (!remaining) return { ok: false, message: '该订单已全部出货' }
    const actualQty = Math.min(reqQty, remaining)
    o.shippedQty = shipped + actualQty
    o.shipmentSeq = (Number(o.shipmentSeq) || 0) + 1
    o.shipments.unshift({
      id: `SH-${o.id}-${String(o.shipmentSeq).padStart(3, '0')}`,
      date: String(payload?.date || todayStr()),
      qty: actualQty,
      manager: String(payload?.manager || payload?.by || '—').trim() || '—',
      tracking: String(payload?.tracking || '').trim(),
      note: String(payload?.note || '').trim(),
    })
    return {
      ok: true,
      qty: actualQty,
      done: o.shippedQty >= total,
      shipmentId: o.shipments[0]?.id || '',
    }
  }

  function setAllowPartialShip(orderId, allow) {
    const o = orders.value.find((x) => x.id === orderId)
    if (!o) return false
    o.allowPartialShip = !!allow
    return true
  }

  function addOrder(payload) {
    const id = nextOrderId(orders.value)
    const signedAt = payload.signedAt || todayStr()
    const ownerTrim = (payload.owner || '徐总').trim() || '徐总'
    const lines = payload.lines.map((l) => {
      const note = (l.note || '').trim()
      const noteRemarkEntries = note
        ? [
            {
              id: newRemarkId(),
              text: note,
              priority: 'normal',
              createdAt: signedAt,
              createdBy: ownerTrim,
              done: false,
            },
          ]
        : []
      return {
        lineId: newLineId(),
        unit: String(l.unit ?? '').trim() || '—',
        model: l.model?.trim() || '',
        temp: String(l.temp ?? '').trim() || '—',
        stitch: String(l.stitch ?? '').trim() || '—',
        qty: Number(l.qty) || 0,
        punch: String(l.punch ?? '').trim() || '—',
        note,
        noteRemarkEntries,
      }
    })
    const totalQty = lines.reduce((s, l) => s + l.qty, 0)
    const order = {
      id,
      customer: payload.customer.trim(),
      customerType: payload.customerType || '国内',
      signedAt: payload.signedAt,
      dueDate: payload.dueDate,
      owner: (payload.owner || '徐总').trim(),
      status: String(payload.initialStatus ?? '草稿').trim() || '草稿',
      totalQty,
      remarkEntries: buildInitialRemarkEntries(payload),
      lines,
      shippedQty: 0,
      shipments: [],
      shipmentSeq: 0,
      shipReleaseApproved: false,
      shipReleaseBy: '',
      allowPartialShip: !!payload.allowPartialShip,
      contractAmount: Number(payload.contractAmount) || 0,
      receivedAmount: Number(payload.receivedAmount) || 0,
    }
    orders.value = [order, ...orders.value]
    return id
  }

  return {
    orders,
    addOrder,
    setOrderStatus,
    appendRemark,
    toggleRemarkDone,
    appendLineRemark,
    toggleLineRemarkDone,
    touchLineStructure,
    setShipRelease,
    recordShipment,
    setAllowPartialShip,
  }
})
