<template>
  <div class="nf-page">
    <el-card shadow="never">
      <template #header>
        <div class="nf-toolbar">
          <span class="nf-toolbar__title">财务往来</span>
          <el-input v-model="kw" clearable placeholder="筛选客户" style="width: 200px" />
        </div>
      </template>
      <el-tabs v-model="activeTab">
        <el-tab-pane label="应收（销售回款）" name="ar" />
        <el-tab-pane label="应付（采购付款）" name="ap" />
      </el-tabs>
      <el-table v-if="activeTab === 'ar'" :data="rows" stripe>
        <el-table-column prop="id" label="来源订单" width="168" />
        <el-table-column prop="customer" label="客户" min-width="120" />
        <el-table-column v-if="rolesStore.canViewOrderFinancials()" prop="contract" label="合同金额" width="120" align="right">
          <template #default="{ row }">¥{{ row.contract.toLocaleString() }}</template>
        </el-table-column>
        <el-table-column v-if="rolesStore.canViewOrderFinancials()" prop="received" label="已收" width="120" align="right">
          <template #default="{ row }">¥{{ row.received.toLocaleString() }}</template>
        </el-table-column>
        <el-table-column v-if="rolesStore.canViewOrderFinancials()" prop="open" label="未收" width="120" align="right">
          <template #default="{ row }">
            <span :class="{ 'nf-warn': row.open > 0 }">¥{{ row.open.toLocaleString() }}</span>
          </template>
        </el-table-column>
        <el-table-column v-if="!rolesStore.canViewOrderFinancials()" label="金额信息" min-width="160">
          <template #default>
            <span class="nf-masked">金额列仅厂长（及管理员）可见；可操作「申请结案」仍以订单数据为准。</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.open <= 0 ? 'success' : 'warning'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="$router.push(`/production-orders/${row.id}`)">生产订单</el-button>
            <el-tooltip
              v-if="row.open <= 0 && row.status !== '已结案'"
              :disabled="rolesStore.can('action_finance_apply_close')"
              :content="permissionTip('action_finance_apply_close')"
              placement="top"
            >
              <span>
                <el-button
                  type="success"
                  link
                  :disabled="!rolesStore.can('action_finance_apply_close')"
                  @click="goClose(row)"
                >
                  申请结案
                </el-button>
              </span>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
      <el-table v-else :data="payableRows" stripe>
        <el-table-column prop="id" label="采购单号" width="168" />
        <el-table-column prop="supplier" label="供应商" min-width="120" />
        <el-table-column prop="status" label="执行状态" width="100" />
        <el-table-column prop="financeAuditStatus" label="财务审核" width="120">
          <template #default="{ row }">
            <el-tag :type="auditTagType(row.financeAuditStatus)" size="small">{{ row.financeAuditStatus }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="rolesStore.canViewOrderFinancials()" prop="totalAmount" label="采购总额" width="120" align="right">
          <template #default="{ row }">¥{{ row.totalAmount.toLocaleString() }}</template>
        </el-table-column>
        <el-table-column v-if="rolesStore.canViewOrderFinancials()" prop="paidAmount" label="已付" width="120" align="right">
          <template #default="{ row }">¥{{ row.paidAmount.toLocaleString() }}</template>
        </el-table-column>
        <el-table-column v-if="rolesStore.canViewOrderFinancials()" prop="openAmount" label="待付" width="120" align="right">
          <template #default="{ row }">
            <span :class="{ 'nf-warn': row.openAmount > 0 }">¥{{ row.openAmount.toLocaleString() }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="$router.push(`/purchase/orders/${row.id}`)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'
import { useProductionOrderStore } from '@/stores/productionOrders'
import { useRolesStore } from '@/stores/roles'
import { useOrderWorkflowStore } from '@/stores/orderWorkflow'
import { usePurchaseOrderStore } from '@/stores/purchaseOrders'
import { useApprovalsStore } from '@/stores/approvals'
import { permissionTip } from '@/utils/permissionMeta'

const router = useRouter()
const kw = ref('')
const activeTab = ref('ar')
const rolesStore = useRolesStore()
const wfStore = useOrderWorkflowStore()
const approvalsStore = useApprovalsStore()
const { orders } = storeToRefs(useProductionOrderStore())
const { orders: purchaseOrders } = storeToRefs(usePurchaseOrderStore())

const rows = computed(() =>
  orders.value
    .filter((o) => !wfStore.isDraftStatus(o.status))
    .map((o) => {
      const open = o.contractAmount - o.receivedAmount
      return {
        id: o.id,
        customer: o.customer,
        contract: o.contractAmount,
        received: o.receivedAmount,
        open,
        status: open <= 0 ? '待结案' : '未结清',
      }
    })
    .filter((r) => !kw.value.trim() || r.customer.includes(kw.value.trim())),
)

const payableRows = computed(() => {
  const k = kw.value.trim()
  return purchaseOrders.value
    .map((po) => {
      const totalAmount = Number(po.totalAmount) || 0
      const paidAmount = Number(po.paidAmount) || 0
      return {
        id: po.id,
        supplier: po.supplier || '—',
        status: po.status || '执行中',
        financeAuditStatus: po.financeAuditStatus || '未提交',
        totalAmount,
        paidAmount,
        openAmount: Math.max(0, totalAmount - paidAmount),
      }
    })
    .filter((r) => !k || r.supplier.includes(k) || r.id.includes(k))
})

function nowTimeStr() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function goClose(row) {
  if (!rolesStore.can('action_finance_apply_close')) {
    ElMessage.warning(permissionTip('action_finance_apply_close'))
    return
  }
  if (!row?.id) return
  if (approvalsStore.hasPendingTypeRef('结案审批', row.id)) {
    ElMessage.warning('该订单已有待审批的结案申请')
    return
  }
  approvalsStore.addPending({
    id: `AP-CLOSE-${row.id}-${Date.now()}`,
    type: '结案审批',
    ref: row.id,
    customer: row.customer || '—',
    submitter: rolesStore.currentRole?.name || '财务',
    time: nowTimeStr(),
  })
  ElMessage.success('已提交结案审批，请到审批中心处理')
  router.push('/approval')
}

function auditTagType(status) {
  if (status === '已通过') return 'success'
  if (status === '待财务审核') return 'warning'
  if (status === '已驳回') return 'danger'
  return 'info'
}
</script>

<style scoped>
.nf-page {
  max-width: 1100px;
  margin: 0 auto;
}
.nf-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.nf-toolbar__title {
  font-weight: 600;
}
.nf-warn {
  color: #b45309;
  font-weight: 600;
}
.nf-masked {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.45;
}
</style>
