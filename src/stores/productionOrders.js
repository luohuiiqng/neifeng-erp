import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { productionOrders as seedFromMock } from '@/mock/data'
import { isProductionOrderReceivedAmountLocked } from '@/utils/orderCloseRules'

const STORAGE_KEY = 'nf_erp_proto_production_orders'
const SCHEMA_KEY = 'nf_erp_proto_orders_schema'
const SCHEMA_VER = '4'

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

function lineRemainingQty(line) {
  const q = Math.max(0, Number(line?.qty) || 0)
  const sh = Math.max(0, Number(line?.shippedQty) || 0)
  return Math.max(0, q - sh)
}

/** 明细行已出数量；旧数据仅有订单 shippedQty 时按行顺序填满 */
function migrateLineShippedQty(o) {
  if (!o?.lines || !Array.isArray(o.lines)) return
  for (const line of o.lines) {
    if (line == null || typeof line !== 'object') continue
    if (line.shippedQty == null || !Number.isFinite(Number(line.shippedQty))) line.shippedQty = 0
    line.shippedQty = Math.max(0, Math.floor(Number(line.shippedQty)))
    line.shippedQty = Math.min(line.shippedQty, Math.max(0, Number(line.qty) || 0))
  }
  const header = Math.max(0, Number(o.shippedQty) || 0)
  const sumLines = o.lines.reduce((s, l) => s + (Number(l.shippedQty) || 0), 0)
  if (sumLines === 0 && header > 0) {
    let remain = header
    for (const line of o.lines) {
      const cap = Math.max(0, Number(line.qty) || 0)
      line.shippedQty = Math.min(cap, remain)
      remain -= line.shippedQty
      if (remain <= 0) break
    }
    if (remain > 0 && o.lines.length) {
      const last = o.lines[o.lines.length - 1]
      const cap = Math.max(0, Number(last.qty) || 0)
      last.shippedQty = Math.min(cap, (Number(last.shippedQty) || 0) + remain)
    }
  } else if (sumLines > 0 && header === 0) {
    o.shippedQty = Math.min(Math.max(0, Number(o.totalQty) || 0), sumLines)
  } else if (sumLines > 0 && header !== sumLines) {
    o.shippedQty = Math.min(Math.max(0, Number(o.totalQty) || 0), sumLines)
  }
}

function migratePendingShipmentPlan(o) {
  if (!o || typeof o !== 'object') return
  if (o.pendingShipmentPlan == null) {
    o.pendingShipmentPlan = null
    return
  }
  if (typeof o.pendingShipmentPlan !== 'object') {
    o.pendingShipmentPlan = null
    return
  }
  const p = o.pendingShipmentPlan
  if (!Array.isArray(p.lineAllocations)) {
    o.pendingShipmentPlan = null
    return
  }
  p.lineAllocations = p.lineAllocations
    .map((x) => ({
      lineId: String(x?.lineId || '').trim(),
      qty: Math.max(0, Math.floor(Number(x?.qty) || 0)),
    }))
    .filter((x) => x.lineId && x.qty > 0)
  const sum = p.lineAllocations.reduce((s, x) => s + x.qty, 0)
  if (sum < 1) {
    o.pendingShipmentPlan = null
    return
  }
  p.batchQty = sum
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
    if (!Array.isArray(s.lineAllocations)) s.lineAllocations = []
    else {
      s.lineAllocations = s.lineAllocations
        .map((x) => ({
          lineId: String(x?.lineId || '').trim(),
          qty: Math.max(0, Math.floor(Number(x?.qty) || 0)),
        }))
        .filter((x) => x.lineId && x.qty > 0)
    }
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

/** 出货台数已满且已放行时，「待出货」自动推进为「已出货」（与结案、界面语义一致） */
function migrateShippedCompleteStatus(o) {
  if (!o || typeof o !== 'object') return
  const total = Math.max(0, Number(o.totalQty) || 0)
  const shipped = Math.max(0, Number(o.shippedQty) || 0)
  if (total <= 0 || shipped < total) return
  if (o.status !== '待出货') return
  if (o.shipReleaseApproved === false) return
  o.status = '已出货'
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
          migrateShippedCompleteStatus(o)
          migrateLineShippedQty(o)
          migratePendingShipmentPlan(o)
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
    migrateShippedCompleteStatus(o)
    migrateLineShippedQty(o)
    migratePendingShipmentPlan(o)
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

  /** 更新已回款；仅已结案后不可再改。 */
  function setOrderReceivedAmount(orderId, nextReceived) {
    const o = orders.value.find((x) => x.id === orderId)
    if (!o) return { ok: false, message: '未找到订单' }
    if (isProductionOrderReceivedAmountLocked(o)) {
      return { ok: false, message: '该订单已结案，已回款金额不可再修改。' }
    }
    const cap = Math.max(0, Number(o.contractAmount) || 0)
    let n = Math.max(0, Number(nextReceived))
    if (!Number.isFinite(n)) n = 0
    if (n > cap) n = cap
    o.receivedAmount = Math.floor(n)
    return { ok: true }
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
    migrateLineShippedQty(o)
  }

  function clearPendingShipmentPlan(orderId) {
    const o = orders.value.find((x) => x.id === orderId)
    if (o) o.pendingShipmentPlan = null
  }

  /** 提交出货审批时写入：本批计划在订单各明细上的台数分配（出货确认须与此一致）。 */
  function setPendingShipmentPlan(orderId, { lineAllocations }) {
    const o = orders.value.find((x) => x.id === orderId)
    if (!o) return { ok: false, message: '未找到订单' }
    migrateLineRemarks(o)
    migrateLineShippedQty(o)
    const lines = o.lines || []
    const clean = []
    for (const a of lineAllocations || []) {
      const lineId = String(a?.lineId || '').trim()
      const q = Math.max(0, Math.floor(Number(a?.qty) || 0))
      if (!lineId || !q) continue
      const line = lines.find((l) => l.lineId === lineId)
      if (!line) return { ok: false, message: '存在无效的明细行' }
      const rem = lineRemainingQty(line)
      if (q > rem) return { ok: false, message: '本批计划在部分明细上超过该条明细的待出数量' }
      clean.push({ lineId, qty: q })
    }
    const batchQty = clean.reduce((s, x) => s + x.qty, 0)
    if (batchQty < 1) return { ok: false, message: '本批计划出货台数至少为 1' }
    const orderRem = Math.max(0, (Number(o.totalQty) || 0) - (Number(o.shippedQty) || 0))
    if (batchQty > orderRem) return { ok: false, message: '本批计划合计不能超过订单待出总台数' }
    if (!o.allowPartialShip && batchQty !== orderRem) {
      return { ok: false, message: `整单出货须一次排满全部待出 ${orderRem} 台` }
    }
    o.pendingShipmentPlan = { batchQty, lineAllocations: clean }
    return { ok: true }
  }

  function pendingShipmentMatchesPlan(o, normalizedAllocations) {
    const p = o?.pendingShipmentPlan
    if (!p?.lineAllocations?.length) return true
    const sumNorm = normalizedAllocations.reduce((s, x) => s + x.qty, 0)
    if (p.batchQty !== sumNorm) return false
    const normMap = new Map(normalizedAllocations.map((x) => [x.lineId, x.qty]))
    for (const x of p.lineAllocations) {
      if ((normMap.get(x.lineId) || 0) !== x.qty) return false
    }
    for (const [lid, q] of normMap) {
      const pi = p.lineAllocations.find((a) => a.lineId === lid)
      const expected = pi ? pi.qty : 0
      if (q !== expected) return false
    }
    return true
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
    migrateLineShippedQty(o)
    migrateLineRemarks(o)
    const lines = o.lines || []
    const reqQty = Math.max(0, Math.floor(Number(typeof payload === 'object' ? payload?.qty : payload) || 0))
    let allocations = Array.isArray(payload?.lineAllocations) ? payload.lineAllocations : []
    if (!allocations.length) {
      if (lines.length === 1) {
        allocations = [{ lineId: lines[0].lineId, qty: reqQty }]
      } else {
        return { ok: false, message: '请按订单明细逐条填写本次拟出的台数' }
      }
    }
    const normalized = []
    for (const a of allocations) {
      const lid = String(a?.lineId || '').trim()
      const q = Math.max(0, Math.floor(Number(a?.qty) || 0))
      if (!lid || !q) continue
      const line = lines.find((l) => l.lineId === lid)
      if (!line) return { ok: false, message: '无效的明细行' }
      const rem = lineRemainingQty(line)
      if (q > rem) return { ok: false, message: '某条订单明细本次出货超过该条待出数量' }
      normalized.push({ lineId: lid, qty: q })
    }
    const actualQty = normalized.reduce((s, x) => s + x.qty, 0)
    if (!actualQty) return { ok: false, message: '出货数量必须大于 0' }
    if (reqQty && reqQty !== actualQty) {
      return { ok: false, message: '本批次总台数须与各条明细本次出货台数之和一致' }
    }
    if (!pendingShipmentMatchesPlan(o, normalized)) {
      return { ok: false, message: '本次明细出货须与「提交出货审批」时填写的本批计划一致' }
    }
    const total = Math.max(0, Number(o.totalQty) || 0)
    const shipped = Math.max(0, Number(o.shippedQty) || 0)
    const remaining = Math.max(0, total - shipped)
    if (!remaining) return { ok: false, message: '该订单已全部出货' }
    if (actualQty > remaining) return { ok: false, message: '本次出货超过订单待出总台数' }
    for (const x of normalized) {
      const line = lines.find((l) => l.lineId === x.lineId)
      line.shippedQty = Math.max(0, Number(line.shippedQty) || 0) + x.qty
    }
    o.shippedQty = shipped + actualQty
    o.shipmentSeq = (Number(o.shipmentSeq) || 0) + 1
    o.shipments.unshift({
      id: `SH-${o.id}-${String(o.shipmentSeq).padStart(3, '0')}`,
      date: String(payload?.date || todayStr()),
      qty: actualQty,
      lineAllocations: normalized.map((x) => ({ lineId: x.lineId, qty: x.qty })),
      manager: String(payload?.manager || payload?.by || '—').trim() || '—',
      tracking: String(payload?.tracking || '').trim(),
      note: String(payload?.note || '').trim(),
    })
    o.pendingShipmentPlan = null
    if (total > 0 && o.shippedQty >= total && o.status === '待出货' && o.shipReleaseApproved !== false) {
      o.status = '已出货'
    }
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

  /** 仅「允许分批出货」时可调整出货目标台数（写入 totalQty），须 ≥ 已出货。 */
  function setShippableTotalQty(orderId, nextTotal) {
    const o = orders.value.find((x) => x.id === orderId)
    if (!o) return { ok: false, message: '未找到订单' }
    if (!o.allowPartialShip) return { ok: false, message: '仅「允许分批出货」的订单可调整出货目标台数' }
    const shipped = Math.max(0, Number(o.shippedQty) || 0)
    let n = Math.floor(Number(nextTotal))
    if (!Number.isFinite(n)) n = shipped
    if (n < 1) return { ok: false, message: '出货目标台数须为正整数' }
    if (n < shipped) return { ok: false, message: '出货目标台数不能小于已出货台数' }
    o.totalQty = n
    return { ok: true }
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
        shippedQty: 0,
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
      pendingShipmentPlan: null,
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
    setShippableTotalQty,
    setPendingShipmentPlan,
    clearPendingShipmentPlan,
    setOrderReceivedAmount,
  }
})
