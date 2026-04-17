import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useProductionOrderStore } from '@/stores/productionOrders'

const STORAGE_KEY = 'nf_erp_order_workflow'
const SCHEMA_KEY = 'nf_erp_order_workflow_schema'
const SCHEMA_VER = '1'

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function defaultStatuses() {
  return [
    {
      id: 'st-draft',
      code: '草稿',
      name: '草稿',
      sortOrder: 10,
      tagType: 'info',
      isDraft: true,
      isClosed: false,
      countsAsRunning: false,
      workshopPanel: 'none',
      allowsShippingSubmit: false,
      showShipPendingExtra: false,
      showShipReleaseExtra: false,
    },
    {
      id: 'st-issued',
      code: '已下发',
      name: '已下发',
      sortOrder: 20,
      tagType: 'info',
      isDraft: false,
      isClosed: false,
      countsAsRunning: true,
      workshopPanel: 'stock',
      allowsShippingSubmit: false,
      showShipPendingExtra: false,
      showShipReleaseExtra: false,
    },
    {
      id: 'st-design',
      code: '设计中',
      name: '设计中',
      sortOrder: 30,
      tagType: 'warning',
      isDraft: false,
      isClosed: false,
      countsAsRunning: true,
      workshopPanel: 'stock',
      allowsShippingSubmit: false,
      showShipPendingExtra: false,
      showShipReleaseExtra: false,
    },
    {
      id: 'st-stock',
      code: '备货中',
      name: '备货中',
      sortOrder: 40,
      tagType: 'warning',
      isDraft: false,
      isClosed: false,
      countsAsRunning: true,
      workshopPanel: 'stock',
      allowsShippingSubmit: false,
      showShipPendingExtra: false,
      showShipReleaseExtra: false,
    },
    {
      id: 'st-prod',
      code: '生产中',
      name: '生产中',
      sortOrder: 50,
      tagType: 'primary',
      isDraft: false,
      isClosed: false,
      countsAsRunning: true,
      workshopPanel: 'produce',
      allowsShippingSubmit: false,
      showShipPendingExtra: false,
      showShipReleaseExtra: false,
    },
    {
      id: 'st-ship-pend',
      code: '待出货审批',
      name: '待出货审批',
      sortOrder: 60,
      tagType: 'warning',
      isDraft: false,
      isClosed: false,
      countsAsRunning: true,
      workshopPanel: 'produce',
      allowsShippingSubmit: false,
      showShipPendingExtra: true,
      showShipReleaseExtra: false,
    },
    {
      id: 'st-ship',
      code: '待出货',
      name: '待出货',
      sortOrder: 70,
      tagType: 'success',
      isDraft: false,
      isClosed: false,
      countsAsRunning: true,
      workshopPanel: 'produce',
      allowsShippingSubmit: true,
      showShipPendingExtra: false,
      showShipReleaseExtra: true,
    },
    {
      id: 'st-shipped',
      code: '已出货',
      name: '已出货',
      sortOrder: 75,
      tagType: 'success',
      isDraft: false,
      isClosed: false,
      countsAsRunning: true,
      workshopPanel: 'produce',
      allowsShippingSubmit: false,
      showShipPendingExtra: false,
      showShipReleaseExtra: false,
    },
    {
      id: 'st-done',
      code: '已结案',
      name: '已结案',
      sortOrder: 80,
      tagType: 'success',
      isDraft: false,
      isClosed: true,
      countsAsRunning: false,
      workshopPanel: 'none',
      allowsShippingSubmit: false,
      showShipPendingExtra: false,
      showShipReleaseExtra: false,
    },
  ]
}

/** effect: default | ship_request | ship_approve | ship_reject */
function defaultTransitions() {
  return [
    {
      id: 'tr-issue',
      fromCode: '草稿',
      toCode: '已下发',
      label: '下发订单',
      permissionKey: 'action_mo_issue',
      effect: 'default',
      sortOrder: 10,
    },
    {
      id: 'tr-to-design',
      fromCode: '已下发',
      toCode: '设计中',
      label: '转入设计',
      permissionKey: 'action_mo_workshop_judge',
      effect: 'default',
      sortOrder: 20,
    },
    {
      id: 'tr-to-stock',
      fromCode: '已下发',
      toCode: '备货中',
      label: '无需设计，转入备货',
      permissionKey: 'action_mo_workshop_judge',
      effect: 'default',
      sortOrder: 30,
    },
    {
      id: 'tr-design-done',
      fromCode: '设计中',
      toCode: '备货中',
      label: '设计完成，转入备货',
      permissionKey: 'action_design_complete',
      effect: 'default',
      sortOrder: 40,
    },
    {
      id: 'tr-start-prod',
      fromCode: '备货中',
      toCode: '生产中',
      label: '开始生产',
      permissionKey: 'action_mo_workshop_judge',
      effect: 'default',
      sortOrder: 50,
    },
    {
      id: 'tr-req-ship',
      fromCode: '生产中',
      toCode: '待出货审批',
      label: '提交出货审批',
      permissionKey: 'action_mo_request_ship',
      effect: 'ship_request',
      sortOrder: 60,
    },
    {
      id: 'tr-ship-ok',
      fromCode: '待出货审批',
      toCode: '待出货',
      label: '审批通过，转入待出货',
      permissionKey: 'action_ship_release',
      effect: 'ship_approve',
      sortOrder: 70,
    },
    {
      id: 'tr-ship-back',
      fromCode: '待出货审批',
      toCode: '生产中',
      label: '审批驳回，退回生产',
      permissionKey: 'action_ship_reject',
      effect: 'ship_reject',
      sortOrder: 80,
    },
  ]
}

function normalizeTransitionLabels(transitions) {
  const byId = {
    'tr-issue': '下发订单',
    'tr-to-design': '转入设计',
    'tr-to-stock': '无需设计，转入备货',
    'tr-design-done': '设计完成，转入备货',
    'tr-start-prod': '开始生产',
    'tr-req-ship': '提交出货审批',
    'tr-ship-ok': '审批通过，转入待出货',
    'tr-ship-back': '审批驳回，退回生产',
  }
  return (transitions || []).map((t) => {
    const raw = String(t?.label || '').trim()
    const next = byId[t?.id]
    if (!next) return t
    // 仅对历史默认文案和“设为xxx”兜底文案做自动修复；保留用户自定义文本。
    if (!raw || raw.startsWith('设为') || raw.includes('→')) {
      return { ...t, label: next }
    }
    return t
  })
}

/** 本地已保存的工作流补全新版默认状态（如新增「已出货」），避免整表重置 */
function mergeMissingDefaultStatuses(parsed) {
  if (!parsed || !Array.isArray(parsed.statuses)) return parsed
  const defaults = defaultStatuses()
  const list = parsed.statuses
  for (const d of defaults) {
    if (!list.some((s) => s && s.code === d.code)) {
      list.push(clone(d))
    }
  }
  return parsed
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
      if (parsed?.statuses?.length && parsed?.transitions?.length) {
        mergeMissingDefaultStatuses(parsed)
        return {
          ...parsed,
          transitions: normalizeTransitionLabels(parsed.transitions),
        }
      }
    }
  } catch {
    /* ignore */
  }
  return { statuses: defaultStatuses(), transitions: defaultTransitions() }
}

export const useOrderWorkflowStore = defineStore('orderWorkflow', () => {
  const data = ref(loadInitial())
  const statuses = computed(() => [...(data.value.statuses || [])].sort((a, b) => a.sortOrder - b.sortOrder))
  const transitions = computed(() => [...(data.value.transitions || [])].sort((a, b) => a.sortOrder - b.sortOrder))

  watch(
    data,
    (v) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
      } catch {
        /* ignore */
      }
    },
    { deep: true },
  )

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.value))
    } catch {
      /* ignore */
    }
  }

  function statusByCode(code) {
    return data.value.statuses.find((s) => s.code === code) || null
  }

  const draftStatusCode = computed(() => {
    const d = data.value.statuses.filter((s) => s.isDraft).sort((a, b) => a.sortOrder - b.sortOrder)[0]
    return d?.code || '草稿'
  })

  function isDraftStatus(code) {
    const s = statusByCode(code)
    return !!s?.isDraft
  }

  function tagTypeFor(code) {
    const s = statusByCode(code)
    const t = s?.tagType
    if (['info', 'success', 'warning', 'danger', 'primary'].includes(t)) return t
    return 'info'
  }

  const runningStatusCodes = computed(() => data.value.statuses.filter((s) => s.countsAsRunning).map((s) => s.code))

  const stockPanelCodes = computed(() => data.value.statuses.filter((s) => s.workshopPanel === 'stock').map((s) => s.code))

  const producePanelCodes = computed(() =>
    data.value.statuses.filter((s) => s.workshopPanel === 'produce').map((s) => s.code),
  )

  const closedStatusCodes = computed(() => data.value.statuses.filter((s) => s.isClosed).map((s) => s.code))

  function isShippableStatusCode(code) {
    const s = statusByCode(code)
    return !!s?.allowsShippingSubmit
  }

  function isClosedStatus(code) {
    return !!statusByCode(code)?.isClosed
  }

  const shipReadyStatusesLabel = computed(() => {
    const parts = [...data.value.statuses]
      .filter((s) => s.allowsShippingSubmit)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => s.name || s.code)
    return parts.length ? parts.map((p) => `「${p}」`).join('或') : '（未配置可出货提交的状态）'
  })

  function transitionsFrom(fromCode) {
    return transitions.value.filter((t) => t.fromCode === fromCode)
  }

  function applyTransition(orderId, transitionId, actorName) {
    const t = data.value.transitions.find((x) => x.id === transitionId)
    const po = useProductionOrderStore()
    const o = po.orders.find((x) => x.id === orderId)
    if (!t || !o) return { ok: false, message: '操作无效' }
    if (o.status !== t.fromCode) return { ok: false, message: '当前状态已变化，请刷新页面' }
    const name = String(actorName || '').trim() || '—'

    switch (t.effect || 'default') {
      case 'ship_request':
        po.setOrderStatus(orderId, t.toCode)
        po.setShipRelease(orderId, false, '')
        break
      case 'ship_approve':
        po.setOrderStatus(orderId, t.toCode)
        po.setShipRelease(orderId, true, name)
        break
      case 'ship_reject':
        po.setOrderStatus(orderId, t.toCode)
        po.setShipRelease(orderId, false, '')
        break
      default:
        po.setOrderStatus(orderId, t.toCode)
    }
    return { ok: true }
  }

  function upsertStatus(row) {
    const list = data.value.statuses
    const i = list.findIndex((s) => s.id === row.id)
    if (i >= 0) list[i] = { ...list[i], ...row }
    else list.push({ ...row })
    persist()
  }

  function removeStatus(id) {
    const s = data.value.statuses.find((x) => x.id === id)
    if (!s) return { ok: false, message: '未找到该状态' }
    const po = useProductionOrderStore()
    if (po.orders.some((o) => o.status === s.code)) {
      return { ok: false, message: '仍有订单使用该状态编码，无法删除' }
    }
    if (data.value.transitions.some((t) => t.fromCode === s.code || t.toCode === s.code)) {
      return { ok: false, message: '请先删除引用该状态的流转规则' }
    }
    data.value.statuses = data.value.statuses.filter((x) => x.id !== id)
    persist()
    return { ok: true }
  }

  function upsertTransition(row) {
    const list = data.value.transitions
    const i = list.findIndex((t) => t.id === row.id)
    if (i >= 0) list[i] = { ...list[i], ...row }
    else list.push({ ...row })
    persist()
  }

  function removeTransition(id) {
    data.value.transitions = data.value.transitions.filter((t) => t.id !== id)
    persist()
  }

  function resetDefaults() {
    data.value = { statuses: defaultStatuses(), transitions: defaultTransitions() }
    persist()
  }

  return {
    data,
    statuses,
    transitions,
    draftStatusCode,
    runningStatusCodes,
    stockPanelCodes,
    producePanelCodes,
    closedStatusCodes,
    statusByCode,
    isDraftStatus,
    tagTypeFor,
    isShippableStatusCode,
    isClosedStatus,
    shipReadyStatusesLabel,
    transitionsFrom,
    applyTransition,
    upsertStatus,
    removeStatus,
    upsertTransition,
    removeTransition,
    resetDefaults,
  }
})
