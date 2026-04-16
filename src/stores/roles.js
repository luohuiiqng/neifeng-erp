import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { MENU_DEFS } from '@/mock/data'
import { useUserStore } from '@/stores/users'

const STORAGE_ROLES = 'nf_erp_proto_roles'
const SCHEMA_KEY = 'nf_erp_proto_roles_schema'
const SCHEMA_VER = '17'

const defaultRoles = () => [
  {
    id: '1',
    code: 'admin',
    name: '系统管理员',
    description: '全部功能，含角色维护',
    permissions: ['*'],
  },
  {
    id: '2',
    code: 'director',
    name: '厂长',
    description: '新建/草稿、生产订单下发；出货审批；可见订单金额、回款及客户管理',
    permissions: [
      'dashboard',
      'customer',
      'supplier',
      'production_order',
      'shipping',
      'finance',
      'approval',
      'warehouse',
      'perm_view_draft_order',
      'perm_view_order_financials',
      'action_customer_create',
      'action_mo_create',
      'action_mo_issue',
      'action_ship_release',
      'action_ship_reject',
      'action_finance_apply_close',
      'action_approve_close',
      'action_approve_pr',
    ],
  },
  {
    id: '3',
    code: 'workshop',
    name: '车间主任',
    description: '判读是否需设计、备货与生产推进；生产结束后申请出货审批；出货确认提交；可批采购申请',
    permissions: [
      'dashboard',
      'production_order',
      'purchase',
      'supplier',
      'shipping',
      'approval',
      'warehouse',
      'action_mo_workshop_judge',
      'action_mo_request_ship',
      'action_ship_submit',
      'action_approve_pr',
    ],
  },
  {
    id: '4',
    code: 'design',
    name: '设计部',
    description: '在「设计中」状态标记设计完成并回到备货',
    permissions: ['dashboard', 'production_order', 'action_design_complete'],
  },
  {
    id: '5',
    code: 'purchase',
    name: '采购',
    description: '请购与执行；提交采购申请及采购单财务审核',
    permissions: ['dashboard', 'purchase', 'supplier', 'warehouse', 'production_order', 'action_pr_submit', 'action_po_submit_finance'],
  },
  {
    id: '6',
    code: 'finance',
    name: '财务',
    description: '应收与结案申请；采购单财务审核；订单上金额与回款仅厂长可见',
    permissions: [
      'dashboard',
      'finance',
      'approval',
      'production_order',
      'action_finance_apply_close',
      'action_finance_audit_po',
    ],
  },
]

function loadRoles() {
  if (localStorage.getItem(SCHEMA_KEY) !== SCHEMA_VER) {
    localStorage.removeItem(STORAGE_ROLES)
    localStorage.setItem(SCHEMA_KEY, SCHEMA_VER)
  }
  try {
    const raw = localStorage.getItem(STORAGE_ROLES)
    if (raw) return migrateLoadedRoles(JSON.parse(raw))
  } catch {
    /* ignore */
  }
  return defaultRoles()
}

function ensurePerm(role, perm) {
  if (!role || !Array.isArray(role.permissions)) return
  if (!role.permissions.includes(perm)) role.permissions.push(perm)
}

function migrateLoadedRoles(list) {
  if (!Array.isArray(list)) return defaultRoles()
  for (const r of list) {
    if (r?.code === 'admin') continue
    // 仓库模块默认开放给厂长/车间/采购，便于采购到货与备料协同。
    if (['director', 'workshop', 'purchase'].includes(r?.code)) ensurePerm(r, 'warehouse')
    if (['director', 'purchase'].includes(r?.code)) ensurePerm(r, 'supplier')
  }
  return list
}

export const useRolesStore = defineStore('roles', () => {
  const roles = ref(loadRoles())
  const userStore = useUserStore()
  const currentRoleCode = computed(() => userStore.currentUser?.roleCode || '')

  const permissionKeys = computed(() =>
    MENU_DEFS.filter((m) => !m.placeholder).map((m) => m.key),
  )

  const currentRole = computed(() => {
    if (!currentRoleCode.value) return null
    return roles.value.find((r) => r.code === currentRoleCode.value) || null
  })

  function persistRoles() {
    localStorage.setItem(STORAGE_ROLES, JSON.stringify(roles.value))
  }

  function can(key) {
    const p = currentRole.value?.permissions || []
    if (p.includes('*')) return true
    return p.includes(key)
  }

  /** 待审批行是否允许点「处理」（按审批类型区分） */
  function canProcessApproval(approval) {
    if (!approval || approval.status !== '待审批') return false
    if (approval.type === '结案审批') return can('action_approve_close')
    if (approval.type === '采购申请') return can('action_approve_pr')
    if (approval.type === '采购单财务审核') return can('action_finance_audit_po')
    return false
  }

  /** 草稿 / 未下发订单仅厂长与管理员可查看（列表与详情） */
  function canViewDraftProductionOrder() {
    return can('perm_view_draft_order')
  }

  /** 订单合同/回款、采购单价金额、财务应收金额列等 — 仅厂长与管理员 */
  function canViewOrderFinancials() {
    return can('perm_view_order_financials')
  }

  function upsertRole(role) {
    const i = roles.value.findIndex((r) => r.id === role.id)
    if (i >= 0) roles.value[i] = { ...roles.value[i], ...role }
    else roles.value.push(role)
    persistRoles()
  }

  function removeRole(id) {
    const r = roles.value.find((x) => x.id === id)
    if (r?.code === 'admin') return false
    roles.value = roles.value.filter((x) => x.id !== id)
    userStore.reassignRole(r?.code || '', 'admin')
    persistRoles()
    return true
  }

  function resetToDefault() {
    roles.value = defaultRoles()
    persistRoles()
  }

  return {
    roles,
    currentRoleCode,
    currentRole,
    permissionKeys,
    can,
    canProcessApproval,
    canViewDraftProductionOrder,
    canViewOrderFinancials,
    upsertRole,
    removeRole,
    resetToDefault,
  }
})
