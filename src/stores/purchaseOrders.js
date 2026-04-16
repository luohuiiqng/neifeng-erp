import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { purchaseOrders as seedFromMock } from '@/mock/data'
import { usePurchaseRequestStore } from '@/stores/purchaseRequests'
import { useWarehouseStore } from '@/stores/warehouse'
import { useSupplierStore } from '@/stores/suppliers'

const STORAGE_KEY = 'nf_erp_proto_purchase_orders'
const SCHEMA_KEY = 'nf_erp_proto_purchase_orders_schema'
const SCHEMA_VER = '1'

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function todayStr() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function nextPoId(existing) {
  const d = new Date()
  const y = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const prefix = `PO-${y}-${mm}${dd}-`
  let maxSeq = 0
  for (const po of existing) {
    const id = String(po?.id || '')
    if (!id.startsWith(prefix)) continue
    const n = parseInt(id.slice(prefix.length), 10)
    if (!Number.isNaN(n)) maxSeq = Math.max(maxSeq, n)
  }
  return `${prefix}${String(maxSeq + 1).padStart(2, '0')}`
}

function normalizePo(po) {
  if (!po || typeof po !== 'object') return
  if (!Array.isArray(po.lines)) po.lines = []
  if (!Array.isArray(po.arrivals)) po.arrivals = []
  if (!po.financeAuditStatus) po.financeAuditStatus = '未提交'
  if (!po.supplierId) po.supplierId = ''
  if (!Number.isFinite(Number(po.paidAmount))) po.paidAmount = 0
  let total = 0
  for (const line of po.lines) {
    if (!line.materialCode) line.materialCode = ''
    if (!line.spec) line.spec = ''
    if (!Number.isFinite(Number(line?.receivedQty))) line.receivedQty = 0
    const qty = Number(line?.qty) || 0
    const amount = Number(line?.amount) || 0
    if (!Number.isFinite(Number(line?.amount)) && Number.isFinite(Number(line?.price))) {
      line.amount = (Number(line.price) || 0) * qty
    }
    total += Number(line?.amount) || amount
  }
  const hasReceived = po.lines.some((l) => (Number(l?.receivedQty) || 0) > 0)
  if (!hasReceived && po.arrivals.length) {
    for (const a of po.arrivals) {
      const qty = Math.max(0, Number(a?.qty) || 0)
      if (!qty) continue
      const idx = Number.isInteger(Number(a?.lineIndex)) ? Number(a.lineIndex) : 0
      const line = po.lines[idx] || po.lines[0]
      if (!line) continue
      line.receivedQty = (Number(line.receivedQty) || 0) + qty
      if (!a.materialCode) a.materialCode = line.materialCode || ''
      if (!a.material) a.material = line.desc || ''
    }
  }
  po.totalAmount = total
}

function recalcStatusByArrival(po) {
  if (!po) return
  if (po.status === '已关闭' || po.status === '已完成') return
  const ordered = (po.lines || []).reduce((s, l) => s + (Number(l?.qty) || 0), 0)
  const arrived = (po.lines || []).reduce((s, l) => s + (Number(l?.receivedQty) || 0), 0)
  if (ordered <= 0 || arrived <= 0) {
    po.status = '执行中'
    return
  }
  if (arrived >= ordered) po.status = '已到货'
  else po.status = '部分到货'
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
        for (const po of parsed) {
          normalizePo(po)
          recalcStatusByArrival(po)
        }
        return parsed
      }
    }
  } catch {
    /* ignore */
  }
  return clone(seedFromMock).map((po) => {
    const next = {
      ...po,
      financeAuditStatus: po.financeAuditStatus || '未提交',
    }
    normalizePo(next)
    recalcStatusByArrival(next)
    return next
  })
}

export const usePurchaseOrderStore = defineStore('purchaseOrders', () => {
  const orders = ref(loadInitial())
  const warehouseStore = useWarehouseStore()
  const supplierStore = useSupplierStore()

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

  function getById(id) {
    return orders.value.find((p) => p.id === id)
  }

  function submitFinanceAudit(id) {
    const po = orders.value.find((p) => p.id === id)
    if (!po) return false
    if (po.financeAuditStatus === '已通过') return false
    if (po.financeAuditStatus === '待财务审核') return false
    po.financeAuditStatus = '待财务审核'
    return true
  }

  function setFinanceAudit(id, status) {
    const po = orders.value.find((p) => p.id === id)
    if (!po) return
    po.financeAuditStatus = status
  }

  function addArrival(id, payload) {
    const po = orders.value.find((p) => p.id === id)
    if (!po) return false
    if (po.status === '已关闭' || po.status === '已完成') return false
    const qty = Math.max(0, Number(payload?.qty) || 0)
    if (qty <= 0) return false
    const lineIndex = Number(payload?.lineIndex)
    const line = Number.isInteger(lineIndex) ? po.lines[lineIndex] : null
    if (!line) return false
    const pendingLine = Math.max(0, (Number(line.qty) || 0) - (Number(line.receivedQty) || 0))
    if (qty > pendingLine) return false
    if (!Array.isArray(po.arrivals)) po.arrivals = []
    line.receivedQty = (Number(line.receivedQty) || 0) + qty
    po.arrivals.push({
      batch: po.arrivals.length + 1,
      lineIndex,
      materialCode: line.materialCode || '',
      material: line.desc || '',
      date: String(payload?.date || '').trim() || '',
      qty,
      by: String(payload?.by || '').trim() || '—',
      note: String(payload?.note || '').trim(),
    })
    recalcStatusByArrival(po)
    warehouseStore.receiveInbound({
      code: line.materialCode || '',
      name: line.desc || '',
      spec: line.spec || '',
      unit: line.unit || '件',
      qty,
      date: String(payload?.date || '').trim() || todayStr(),
      operator: String(payload?.by || '').trim() || '采购',
      refType: '采购到货',
      refId: po.id,
      note: String(payload?.note || '').trim(),
    })
    return true
  }

  function setExecutionStatus(id, nextStatus) {
    const po = orders.value.find((p) => p.id === id)
    if (!po) return { ok: false, message: '未找到采购订单' }
    const next = String(nextStatus || '').trim()
    if (!['执行中', '部分到货', '已到货', '已完成', '已关闭'].includes(next)) {
      return { ok: false, message: '状态无效' }
    }
    if (next === '已完成') {
      if ((Number(po.totalAmount) || 0) > (Number(po.paidAmount) || 0)) {
        return { ok: false, message: '待付款未清，不能标记完成' }
      }
      if (po.financeAuditStatus !== '已通过') {
        return { ok: false, message: '财务审核未通过，不能标记完成' }
      }
      const ordered = (po.lines || []).reduce((s, l) => s + (Number(l?.qty) || 0), 0)
      const arrived = (po.lines || []).reduce((s, l) => s + (Number(l?.receivedQty) || 0), 0)
      if (arrived < ordered) return { ok: false, message: '仍有未到货数量，不能标记完成' }
    }
    po.status = next
    return { ok: true }
  }

  function recordPayment(id, amount) {
    const po = orders.value.find((p) => p.id === id)
    if (!po) return false
    const delta = Math.max(0, Number(amount) || 0)
    if (!delta) return false
    normalizePo(po)
    const cap = Math.max(0, Number(po.totalAmount) || 0)
    po.paidAmount = Math.min(cap, (Number(po.paidAmount) || 0) + delta)
    return true
  }

  function listByRequestId(requestId) {
    return orders.value.filter((po) => po.requestId === requestId)
  }

  function createFromRequest(request, payload = {}) {
    if (!request || !Array.isArray(request.lines) || request.lines.length <= 0) return null
    const id = nextPoId(orders.value)
    const lines = request.lines.map((l) => {
      const materialCode = String(l?.materialCode || '').trim()
      const material = warehouseStore.materialByCode(materialCode)
      if (!material) return null
      const qty = Number(l?.qty) || 0
      const price = Number(l?.price) || 0
      const amount = Number(l?.amount) || price * qty
      return {
        materialCode,
        desc: material.name,
        spec: material.spec || '',
        qty,
        unit: material.unit || String(l?.unit || '').trim() || '件',
        price,
        amount,
        due: String(l?.needDate || payload.date || todayStr()).trim(),
        receivedQty: 0,
      }
    })
    if (lines.some((x) => !x)) return null
    const supplierId = String(payload.supplierId || '').trim()
    const supplier = supplierStore.getById(supplierId)
    const supplierName = String(payload.supplier || '').trim() || supplier?.name || ''
    const po = {
      id,
      supplierId: supplier?.id || '',
      supplier: supplierName || '待定供应商',
      requestId: request.id,
      date: String(payload.date || todayStr()).trim(),
      status: '执行中',
      financeAuditStatus: '未提交',
      lines,
      arrivals: [],
      paidAmount: 0,
    }
    normalizePo(po)
    recalcStatusByArrival(po)
    orders.value.unshift(po)
    return id
  }

  function supplierSnapshot(poOrId) {
    const po = typeof poOrId === 'string' ? getById(poOrId) : poOrId
    if (!po) return null
    const byId = po.supplierId ? supplierStore.getById(po.supplierId) : null
    const byName = supplierStore.findByName(po.supplier || '')
    return byId || byName || null
  }

  /** 汇总关联到指定生产订单的采购订单行金额（用于厂长在订单侧查看） */
  function sumAmountForProductionOrder(moId) {
    const mid = String(moId || '').trim()
    if (!mid) return 0
    const prStore = usePurchaseRequestStore()
    let total = 0
    for (const po of orders.value) {
      const pr = prStore.getById(po.requestId)
      if (pr?.productionOrderId !== mid) continue
      normalizePo(po)
      total += Number(po.totalAmount) || 0
    }
    return total
  }

  return {
    orders,
    getById,
    submitFinanceAudit,
    setFinanceAudit,
    addArrival,
    recordPayment,
    setExecutionStatus,
    listByRequestId,
    createFromRequest,
    supplierSnapshot,
    sumAmountForProductionOrder,
  }
})
