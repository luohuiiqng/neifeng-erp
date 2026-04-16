import { createRouter, createWebHistory } from 'vue-router'
import { useRolesStore } from '@/stores/roles'
import { useProductionOrderStore } from '@/stores/productionOrders'
import { useUserStore } from '@/stores/users'

import MainLayout from '@/layouts/MainLayout.vue'

const routes = [
  {
    path: '/login',
    name: 'Login',
    meta: { title: '登录' },
    component: () => import('@/views/Login.vue'),
  },
  {
    path: '/',
    component: MainLayout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        meta: { title: '工作台', perm: 'dashboard' },
        component: () => import('@/views/Dashboard.vue'),
      },
      {
        path: 'production-orders',
        name: 'ProductionOrderList',
        meta: { title: '生产订单', perm: 'production_order' },
        component: () => import('@/views/production/ProductionOrderList.vue'),
      },
      {
        path: 'production-orders/new',
        name: 'ProductionOrderNew',
        meta: { title: '新建生产订单', perm: 'production_order' },
        component: () => import('@/views/production/NewProductionOrder.vue'),
      },
      {
        path: 'production-orders/:id',
        name: 'ProductionOrderDetail',
        meta: { title: '生产订单详情', perm: 'production_order' },
        component: () => import('@/views/production/ProductionOrderDetail.vue'),
      },
      {
        path: 'customers',
        name: 'Customers',
        meta: { title: '客户管理', perm: 'customer' },
        component: () => import('@/views/Customers.vue'),
      },
      {
        path: 'purchase/requests',
        name: 'PurchaseRequestList',
        meta: { title: '采购申请', perm: 'purchase' },
        component: () => import('@/views/purchase/PurchaseRequestList.vue'),
      },
      {
        path: 'purchase/requests/:id',
        name: 'PurchaseRequestDetail',
        meta: { title: '采购申请详情', perm: 'purchase' },
        component: () => import('@/views/purchase/PurchaseRequestDetail.vue'),
      },
      {
        path: 'purchase/orders/:id',
        name: 'PurchaseOrderDetail',
        meta: { title: '采购订单', perm: 'purchase' },
        component: () => import('@/views/purchase/PurchaseOrderDetail.vue'),
      },
      {
        path: 'shipping',
        name: 'Shipping',
        meta: { title: '出货确认', perm: 'shipping' },
        component: () => import('@/views/Shipping.vue'),
      },
      {
        path: 'finance/receivables',
        name: 'FinanceReceivable',
        meta: { title: '财务应收', perm: 'finance' },
        component: () => import('@/views/FinanceReceivable.vue'),
      },
      {
        path: 'approval',
        name: 'ApprovalList',
        meta: { title: '审批中心', perm: 'approval' },
        component: () => import('@/views/ApprovalList.vue'),
      },
      {
        path: 'approval/:id',
        name: 'ApprovalDetail',
        meta: { title: '审批处理', perm: 'approval' },
        component: () => import('@/views/ApprovalDetail.vue'),
      },
      {
        path: 'system/users',
        name: 'UserManagement',
        meta: { title: '用户账号', perm: 'users' },
        component: () => import('@/views/system/UserManagement.vue'),
      },
      {
        path: 'system/roles',
        name: 'RoleManagement',
        meta: { title: '角色管理', perm: 'roles' },
        component: () => import('@/views/system/RoleManagement.vue'),
      },
      {
        path: 'sales-next',
        name: 'SalesNext',
        meta: { title: '销售管理', perm: 'dashboard', placeholder: true, page: 'sales' },
        component: () => import('@/views/PlaceholderPage.vue'),
      },
      {
        path: 'production',
        name: 'Production',
        meta: { title: '车间执行', perm: 'dashboard', placeholder: true, page: 'production' },
        component: () => import('@/views/PlaceholderPage.vue'),
      },
      {
        path: 'warehouse',
        name: 'Warehouse',
        meta: { title: '仓库', perm: 'dashboard', placeholder: true, page: 'warehouse' },
        component: () => import('@/views/PlaceholderPage.vue'),
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to) => {
  const userStore = useUserStore()
  if (to.name === 'Login') {
    if (userStore.isLoggedIn) return { path: '/dashboard' }
    return true
  }
  if (!userStore.isLoggedIn) return { path: '/login' }

  const store = useRolesStore()
  const perm = to.meta?.perm
  if (perm && !store.can(perm)) return { path: '/dashboard' }
  if (to.name === 'ProductionOrderNew' && !store.can('action_mo_create')) {
    return { path: '/production-orders' }
  }
  if (to.name === 'ProductionOrderDetail') {
    const po = useProductionOrderStore()
    const id = to.params.id
    const o = po.orders.find((x) => x.id === id)
    if (o?.status === '草稿' && !store.canViewDraftProductionOrder()) {
      return { path: '/production-orders' }
    }
  }
  return true
})

export default router
