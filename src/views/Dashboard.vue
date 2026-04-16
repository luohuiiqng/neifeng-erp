<template>
  <div class="nf-page">
    <div class="nf-dash-intro">
      <h1 class="nf-dash-intro__title">工作台</h1>
      <p class="nf-dash-intro__sub">
        <el-tag type="primary" effect="plain" round size="small">{{ rolesStore.currentRole?.name || '—' }}</el-tag>
        <span class="nf-dash-intro__focus">{{ roleFocusLine }}</span>
      </p>
    </div>

    <el-row :gutter="16">
      <el-col v-for="card in statCards" :key="card.key" :span="statColSpan">
        <el-card shadow="never" class="nf-stat">
          <div class="nf-stat__label">{{ card.label }}</div>
          <div class="nf-stat__value">{{ card.displayValue }}</div>
          <div class="nf-stat__hint">{{ card.hint }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="nf-row-mt">
      <el-col :span="14">
        <!-- 待办审批 -->
        <el-card v-if="primaryPanel === 'approval'" shadow="never">
          <template #header>
            <div class="nf-card-head">
              <span>待我审批</span>
              <el-button type="primary" link @click="$router.push('/approval')">进入审批中心</el-button>
            </div>
          </template>
          <el-table :data="pendingApprovals" stripe style="width: 100%">
            <el-table-column prop="type" label="类型" width="110" />
            <el-table-column prop="ref" label="单号" width="150" />
            <el-table-column prop="customer" label="客户/摘要" min-width="120" />
            <el-table-column prop="submitter" label="提交人" width="100" />
            <el-table-column prop="time" label="时间" width="160" />
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-if="rolesStore.canProcessApproval(row)"
                  type="primary"
                  link
                  @click="$router.push(`/approval/${row.id}`)"
                >
                  处理
                </el-button>
                <span v-else class="nf-muted">—</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <!-- 采购：申请与执行入口 -->
        <el-card v-else-if="primaryPanel === 'purchase'" shadow="never">
          <template #header>
            <div class="nf-card-head">
              <span>采购申请</span>
              <el-button type="primary" link @click="$router.push('/purchase/requests')">采购申请列表</el-button>
            </div>
          </template>
          <el-table :data="purchaseRequests" stripe style="width: 100%">
            <el-table-column prop="id" label="申请单号" width="150" />
            <el-table-column prop="productionOrderId" label="关联生产订单" width="150" />
            <el-table-column prop="applicant" label="申请人" width="100" />
            <el-table-column prop="status" label="状态" width="100" />
            <el-table-column label="操作" width="88" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link @click="$router.push(`/purchase/requests/${row.id}`)">详情</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <!-- 车间：已下发在制 -->
        <el-card v-else-if="primaryPanel === 'running_mo_focus'" shadow="never">
          <template #header>
            <div class="nf-card-head">
              <span>已下发 · 在制生产订单</span>
              <el-button type="primary" link @click="$router.push('/production-orders')">全部订单</el-button>
            </div>
          </template>
          <p class="nf-panel-hint">
            草稿由厂长<strong>下发</strong>后各岗位可见。车间主任判读是否需设计并推进备货与生产；<strong>备货中</strong>与<strong>生产中 / 待出货审批</strong>分开展示。
          </p>
          <h4 class="nf-subtitle">备货中（含设计中/已下发）</h4>
          <el-table :data="stockOrdersPreview" stripe style="width: 100%">
            <el-table-column prop="id" label="订单号" width="160" />
            <el-table-column prop="customer" label="客户" />
            <el-table-column prop="dueDate" label="交期" width="110" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="88" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link @click="$router.push(`/production-orders/${row.id}`)">详情</el-button>
              </template>
            </el-table-column>
          </el-table>
          <h4 class="nf-subtitle">生产中（含待出货审批 / 待出货）</h4>
          <el-table :data="producingOrdersPreview" stripe style="width: 100%">
            <el-table-column prop="id" label="订单号" width="160" />
            <el-table-column prop="customer" label="客户" />
            <el-table-column prop="dueDate" label="交期" width="110" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="88" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link @click="$router.push(`/production-orders/${row.id}`)">详情</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="nf-panel-footer">
            <el-button link type="primary" @click="$router.push('/approval')">审批中心</el-button>
          </div>
        </el-card>

        <el-card v-else shadow="never">
          <p class="nf-empty-hint">请从左侧菜单进入业务模块。</p>
        </el-card>
      </el-col>

      <el-col :span="10">
        <el-card shadow="never">
          <template #header>
            <div class="nf-card-head">
              <span>快捷入口</span>
            </div>
          </template>
          <div class="nf-quick">
            <el-button v-if="rolesStore.can('production_order')" type="primary" @click="$router.push('/production-orders')">
              生产订单
            </el-button>
            <el-button v-if="rolesStore.can('purchase')" @click="$router.push('/purchase/requests')">采购申请</el-button>
            <el-button v-if="rolesStore.can('shipping')" @click="$router.push('/shipping')">出货确认</el-button>
            <el-button v-if="rolesStore.can('finance')" @click="$router.push('/finance/receivables')">财务应收</el-button>
            <el-button v-if="rolesStore.can('approval')" @click="$router.push('/approval')">审批中心</el-button>
            <el-button v-if="rolesStore.can('customer')" @click="$router.push('/customers')">客户管理</el-button>
            <el-button v-if="rolesStore.can('roles')" @click="$router.push('/system/roles')">角色管理</el-button>
          </div>
          <el-divider />
          <p class="nf-tip">{{ roleQuickTip }}</p>
        </el-card>
      </el-col>
    </el-row>

    <el-card v-if="rolesStore.can('production_order')" shadow="never" class="nf-row-mt">
      <template #header>
        <div class="nf-card-head">
          <span>{{ topOrdersTitle }}</span>
          <el-button type="primary" link @click="$router.push('/production-orders')">查看全部</el-button>
        </div>
      </template>
      <el-table :data="topOrdersDisplay" stripe>
        <el-table-column prop="id" label="订单号" width="160" />
        <el-table-column prop="customer" label="客户" />
        <el-table-column prop="dueDate" label="要求交期" width="120" />
        <el-table-column v-if="showOpenAmountColumn" prop="openAmount" label="未收" width="110" align="right">
          <template #default="{ row }">
            {{ formatMoney(row.openAmount) }}
          </template>
        </el-table-column>
        <el-table-column prop="totalQty" label="台数" width="72" align="center" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="88" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="$router.push(`/production-orders/${row.id}`)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useApprovalsStore } from '@/stores/approvals'
import { useProductionOrderStore } from '@/stores/productionOrders'
import { useRolesStore } from '@/stores/roles'
import { useOrderWorkflowStore } from '@/stores/orderWorkflow'
import { usePurchaseRequestStore } from '@/stores/purchaseRequests'

const poStore = useProductionOrderStore()
const approvalsStore = useApprovalsStore()
const rolesStore = useRolesStore()
const wfStore = useOrderWorkflowStore()
const prStore = usePurchaseRequestStore()
const { orders } = storeToRefs(poStore)
const { requests: purchaseRequests } = storeToRefs(prStore)

const roleCode = computed(() => rolesStore.currentRole?.code || '')

const ROLE_FOCUS = {
  admin: '可维护角色与账号权限；以下为权限范围内的统计与待办。',
  director: '新建与下发订单；草稿仅您与管理员可见；出货审批与客户/金额信息归您。',
  workshop: '判读设计需求、推进备货与生产；生产结束后申请出货审批；出货确认提交；可批采购申请。',
  design: '在「设计中」订单上标记设计完成。',
  purchase: '请购、采购订单与提交财务审核；单价金额仅厂长可见。',
  finance: '应收与结案申请、采购单财务审核；订单金额列对财务脱敏，仅厂长可见具体数额。',
}

const roleFocusLine = computed(() => ROLE_FOCUS[roleCode.value] || '请从侧栏进入各业务模块。')

const pendingApprovals = computed(() => approvalsStore.items.filter((a) => a.status === '待审批'))

const stats = computed(() => {
  const runningSet = new Set(wfStore.runningStatusCodes)
  const running = orders.value.filter((o) => runningSet.has(o.status)).length
  const unpaid = rolesStore.canViewOrderFinancials()
    ? orders.value.reduce((s, o) => s + (o.contractAmount - o.receivedAmount), 0)
    : 0
  const actionableApproval = pendingApprovals.value.filter((a) => {
    const p = rolesStore.currentRole?.permissions || []
    if (p.includes('*')) return true
    if (a.type === '结案审批') return p.includes('action_approve_close')
    if (a.type === '采购申请') return p.includes('action_approve_pr')
    if (a.type === '采购单财务审核') return p.includes('action_finance_audit_po')
    return false
  }).length
  return { running, unpaid, actionableApproval, pendingApprovalTotal: pendingApprovals.value.length }
})

const stockOrdersPreview = computed(() => {
  const set = new Set(wfStore.stockPanelCodes)
  return orders.value.filter((o) => set.has(o.status)).slice(0, 8)
})

const producingOrdersPreview = computed(() => {
  const set = new Set(wfStore.producePanelCodes)
  return orders.value.filter((o) => set.has(o.status)).slice(0, 8)
})

const primaryPanel = computed(() => {
  const code = roleCode.value
  if (code === 'workshop') return 'running_mo_focus'
  if (code === 'purchase') return 'purchase'
  if (rolesStore.can('approval')) return 'approval'
  return 'none'
})

const statCards = computed(() => {
  const cards = []
  if (rolesStore.can('production_order')) {
    cards.push({
      key: 'mo',
      label: '在制生产订单',
      displayValue: stats.value.running,
      hint: `在制状态：${wfStore.runningStatusCodes.join('、') || '—'}`,
    })
  }
  if (roleCode.value === 'workshop') {
    const runSet = new Set(wfStore.runningStatusCodes)
    const n = orders.value.filter((o) => runSet.has(o.status)).length
    cards.push({
      key: 'run',
      label: '已下发·在制',
      displayValue: n,
      hint: '备货中与生产中分开展示（左栏）',
    })
  }
  if (roleCode.value === 'director' || roleCode.value === 'admin') {
    const n = orders.value.filter((o) => wfStore.isDraftStatus(o.status)).length
    cards.push({
      key: 'draft',
      label: '未下发（草稿）',
      displayValue: n,
      hint: '仅厂长/管理员可见；详情点「下发」',
    })
  }
  if (roleCode.value === 'purchase') {
    cards.push({
      key: 'pr',
      label: '采购申请（条）',
      displayValue: purchaseRequests.value.length,
      hint: '可进入详情查看',
    })
  }
  if (rolesStore.can('approval') && roleCode.value !== 'workshop') {
    const { actionableApproval, pendingApprovalTotal } = stats.value
    cards.push({
      key: 'ap',
      label: '待我审批',
      displayValue: actionableApproval > 0 ? actionableApproval : pendingApprovalTotal,
      hint:
        actionableApproval > 0
          ? `我可处理 ${actionableApproval} 条`
          : `共 ${pendingApprovalTotal} 条（当前身份可能不可处理）`,
    })
  }
  if (rolesStore.can('shipping')) {
    cards.push({
      key: 'ship',
      label: '本月出货（台）',
      displayValue: '—',
      hint: '生产与仓库将单独对接',
    })
  }
  if (rolesStore.can('finance') && rolesStore.canViewOrderFinancials()) {
    cards.push({
      key: 'ar',
      label: '未回款',
      displayValue: formatMoney(stats.value.unpaid),
      hint: '来自生产订单合同与回款',
    })
  }
  return cards
})

const statColSpan = computed(() => {
  const n = statCards.value.length
  if (n <= 0) return 24
  if (n === 1) return 24
  if (n === 2) return 12
  if (n === 3) return 8
  return 6
})

const topOrdersTitle = computed(() => {
  if (roleCode.value === 'finance') return '财务关注 · 生产订单 TOP5'
  if (roleCode.value === 'workshop') return '进度关注 · 在制生产订单 TOP5'
  return '在制生产订单 TOP5'
})

const showOpenAmountColumn = computed(() => rolesStore.can('finance') && rolesStore.canViewOrderFinancials())

const topOrdersDisplay = computed(() => {
  let list = orders.value.filter((o) => !wfStore.isClosedStatus(o.status))
  if (!rolesStore.canViewDraftProductionOrder()) {
    list = list.filter((o) => !wfStore.isDraftStatus(o.status))
  }
  if (roleCode.value === 'finance') {
    list = [...list].sort((a, b) => {
      if (rolesStore.canViewOrderFinancials()) {
        const oa = a.contractAmount - a.receivedAmount
        const ob = b.contractAmount - b.receivedAmount
        return ob - oa
      }
      return (a.dueDate || '').localeCompare(b.dueDate || '')
    })
  }
  return list.slice(0, 5).map((o) => ({
    ...o,
    openAmount: o.contractAmount - o.receivedAmount,
  }))
})

const roleQuickTip = computed(() => {
  const tips = {
    admin: '可在此体验各角色差异；「角色管理」可调整菜单与「操作·…」权限。',
    director: '列表「新建」→ 草稿 →「下发」；出货须在订单详情同意；客户与金额见专属菜单/页签。',
    workshop: '推进设计/备货/生产；生产结束后申请出货审批；厂长同意后再到出货页提交。',
    design: '打开「设计中」的订单详情，点「设计完成」进入备货。',
    purchase: '提交采购申请审批；采购单可提交财务审核。',
    finance: '处理采购单财务审核；结案申请仍走审批中心；金额明细仅厂长可见。',
  }
  return tips[roleCode.value] || '请联系管理员配置账号与角色权限。'
})

function formatMoney(n) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  return `¥${n.toLocaleString()}`
}

function statusType(s) {
  return wfStore.tagTypeFor(s)
}
</script>

<style scoped>
.nf-page {
  max-width: 1280px;
  margin: 0 auto;
}
.nf-dash-intro {
  margin-bottom: 20px;
}
.nf-dash-intro__title {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 700;
  color: #111827;
}
.nf-dash-intro__sub {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 14px;
  color: #4b5563;
  line-height: 1.5;
}
.nf-dash-intro__focus {
  flex: 1;
  min-width: 200px;
}
.nf-stat {
  text-align: left;
  margin-bottom: 16px;
}
.nf-stat__label {
  font-size: 13px;
  color: #6b7280;
}
.nf-stat__value {
  font-size: 28px;
  font-weight: 700;
  color: #111827;
  margin: 8px 0 4px;
  letter-spacing: -0.02em;
}
.nf-stat__hint {
  font-size: 12px;
  color: #9ca3af;
}
.nf-row-mt {
  margin-top: 0;
}
.nf-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}
.nf-quick {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.nf-quick :deep(.el-button) {
  width: 100%;
  margin: 0;
}
.nf-tip {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.6;
}
.nf-muted {
  color: #9ca3af;
  font-size: 13px;
}
.nf-empty-hint,
.nf-panel-hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.55;
}
.nf-panel-footer {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.nf-subtitle {
  margin: 8px 0;
  font-size: 13px;
  color: #4b5563;
}
</style>
