import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { purchaseOrders as seedFromMock, purchaseRequests } from '@/mock/data'

const STORAGE_KEY = 'nf_erp_proto_purchase_orders'

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length) {
        for (const po of parsed) {
          if (po && typeof po === 'object' && !po.financeAuditStatus) po.financeAuditStatus = '未提交'
        }
        return parsed
      }
    }
  } catch {
    /* ignore */
  }
  return clone(seedFromMock).map((po) => ({
    ...po,
    financeAuditStatus: po.financeAuditStatus || '未提交',
  }))
}

export const usePurchaseOrderStore = defineStore('purchaseOrders', () => {
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

  /** 汇总关联到指定生产订单的采购订单行金额（用于厂长在订单侧查看） */
  function sumAmountForProductionOrder(moId) {
    const mid = String(moId || '').trim()
    if (!mid) return 0
    let total = 0
    for (const po of orders.value) {
      const pr = purchaseRequests.find((r) => r.id === po.requestId)
      if (pr?.productionOrderId !== mid) continue
      for (const line of po.lines || []) {
        total += Number(line.amount) || 0
      }
    }
    return total
  }

  return { orders, getById, submitFinanceAudit, setFinanceAudit, sumAmountForProductionOrder }
})
