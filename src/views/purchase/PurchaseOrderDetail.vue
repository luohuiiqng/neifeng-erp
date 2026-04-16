<template>
  <div class="nf-page" v-if="po">
    <el-page-header @back="$router.push('/purchase/requests')" content="采购订单" class="nf-back" />
    <el-card shadow="never" class="nf-row-mt">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="采购单号">{{ po.id }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag>{{ po.status }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="财务审核">
          <el-tag :type="financeTagType(po.financeAuditStatus)">{{ po.financeAuditStatus || '未提交' }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="供应商">{{ po.supplier }}</el-descriptions-item>
        <el-descriptions-item label="下单日期">{{ po.date }}</el-descriptions-item>
        <el-descriptions-item label="关联申请">
          <el-button type="primary" link @click="$router.push(`/purchase/requests/${po.requestId}`)">
            {{ po.requestId }}
          </el-button>
        </el-descriptions-item>
      </el-descriptions>

      <h4 class="nf-h4">订单明细</h4>
      <el-table :data="po.lines" stripe border>
        <el-table-column type="index" width="50" />
        <el-table-column prop="desc" label="物料描述" min-width="160" />
        <el-table-column prop="qty" label="数量" width="72" />
        <el-table-column prop="unit" label="单位" width="64" />
        <el-table-column v-if="rolesStore.canViewOrderFinancials()" prop="price" label="单价" width="88">
          <template #default="{ row }">¥{{ row.price?.toLocaleString() }}</template>
        </el-table-column>
        <el-table-column v-if="rolesStore.canViewOrderFinancials()" prop="amount" label="金额" width="100">
          <template #default="{ row }">¥{{ row.amount?.toLocaleString() }}</template>
        </el-table-column>
        <el-table-column v-if="!rolesStore.canViewOrderFinancials()" label="单价/金额" min-width="120">
          <template #default>仅厂长可见</template>
        </el-table-column>
        <el-table-column prop="due" label="交期" width="118" />
      </el-table>

      <h4 class="nf-h4">到货登记</h4>
      <p class="nf-muted nf-mb">不做库存账务校验，仅记录批次与数量。</p>
      <el-table :data="po.arrivals" stripe border>
        <el-table-column prop="batch" label="批次" width="72" />
        <el-table-column prop="date" label="到货日期" width="120" />
        <el-table-column prop="qty" label="到货数量" width="100" />
        <el-table-column prop="by" label="登记人" width="100" />
        <el-table-column prop="note" label="备注" min-width="140" />
      </el-table>

      <div class="nf-actions">
        <el-button type="primary" disabled>登记到货</el-button>
        <el-button
          v-if="rolesStore.can('action_po_submit_finance') && canSubmitFinance"
          type="warning"
          @click="onSubmitFinance"
        >
          提交财务审核
        </el-button>
      </div>
      <p v-if="rolesStore.can('action_finance_audit_po') && po.financeAuditStatus === '待财务审核'" class="nf-muted nf-mt">
        已生成审批中心待办，请财务在「审批中心」处理。
      </p>
    </el-card>
  </div>
  <el-empty v-else description="未找到采购订单" />
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { usePurchaseOrderStore } from '@/stores/purchaseOrders'
import { useApprovalsStore } from '@/stores/approvals'
import { useRolesStore } from '@/stores/roles'

const route = useRoute()
const purchaseStore = usePurchaseOrderStore()
const approvalsStore = useApprovalsStore()
const rolesStore = useRolesStore()

const po = computed(() => purchaseStore.getById(route.params.id))

const canSubmitFinance = computed(() => {
  const s = po.value?.financeAuditStatus
  return s === '未提交' || s === '已驳回' || !s
})

function financeTagType(s) {
  if (s === '已通过') return 'success'
  if (s === '待财务审核') return 'warning'
  if (s === '已驳回') return 'danger'
  return 'info'
}

function nowTimeStr() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function onSubmitFinance() {
  if (!po.value) return
  if (approvalsStore.hasPendingTypeRef('采购单财务审核', po.value.id)) {
    ElMessage.warning('该采购单已有待财务审核的审批，请勿重复提交')
    return
  }
  const ok = purchaseStore.submitFinanceAudit(po.value.id)
  if (!ok) {
    ElMessage.warning('当前状态不可提交财务审核')
    return
  }
  const apId = `AP-PO-${po.value.id}-${Date.now()}`
  approvalsStore.addPending({
    id: apId,
    type: '采购单财务审核',
    ref: po.value.id,
    customer: po.value.supplier || '—',
    submitter: rolesStore.currentRole?.name || '采购',
    time: nowTimeStr(),
  })
  ElMessage.success('已提交财务审核，请在审批中心处理')
}
</script>

<style scoped>
.nf-page {
  max-width: 1000px;
  margin: 0 auto;
}
.nf-back :deep(.el-page-header__content) {
  font-weight: 600;
}
.nf-row-mt {
  margin-top: 16px;
}
.nf-h4 {
  margin: 20px 0 12px;
  font-size: 15px;
}
.nf-muted {
  color: #6b7280;
  font-size: 13px;
}
.nf-mb {
  margin-bottom: 10px;
}
.nf-mt {
  margin-top: 10px;
}
.nf-actions {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
</style>
