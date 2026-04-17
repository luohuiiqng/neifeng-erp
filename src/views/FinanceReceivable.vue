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
            <span class="nf-masked">金额列仅厂长（及管理员）可见；「申请结案」须回款结清且生产状态为「已出货」。</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.open <= 0 ? 'success' : 'warning'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="$router.push(`/production-orders/${row.id}`)">生产订单</el-button>
            <el-button
              v-if="(rolesStore.can('finance') || rolesStore.canViewOrderFinancials()) && !row.receiveLocked"
              type="warning"
              link
              @click="openReceiveDialog(row)"
            >
              登记回款
            </el-button>
            <span v-else-if="(rolesStore.can('finance') || rolesStore.canViewOrderFinancials()) && row.receiveLocked" class="nf-muted">回款已锁定</span>
            <el-tooltip v-if="!row.moClosed" :disabled="closeApplyEnabled(row)" :content="closeApplyTooltip(row)" placement="top">
              <span>
                <el-button type="success" link :disabled="!closeApplyEnabled(row)" @click="goClose(row)">申请结案</el-button>
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

    <el-dialog v-model="receiveDialogVisible" title="登记回款" width="440px" destroy-on-close @closed="receiveDialogOrderId = ''">
      <p v-if="receiveDialogOrder" class="nf-muted">订单 {{ receiveDialogOrder.id }} · {{ receiveDialogOrder.customer }}</p>
      <el-form v-if="receiveDialogOrder" label-width="100px" class="nf-mt">
        <el-form-item label="合同金额">
          <span>¥{{ receiveDialogContract.toLocaleString() }}</span>
        </el-form-item>
        <el-form-item label="已回款" required>
          <el-input-number v-model="receiveDialogDraft" :min="0" :max="receiveDialogContract" :step="1000" style="width: 220px" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="receiveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmReceiveDialog">保存</el-button>
      </template>
    </el-dialog>
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
import {
  isProductionOrderFullyShipped,
  isProductionOrderReadyForCaseClose,
  isProductionOrderReceivedAmountLocked,
} from '@/utils/orderCloseRules'

const router = useRouter()
const kw = ref('')
const activeTab = ref('ar')
const rolesStore = useRolesStore()
const wfStore = useOrderWorkflowStore()
const approvalsStore = useApprovalsStore()
const poStore = useProductionOrderStore()
const { orders } = storeToRefs(poStore)
const { orders: purchaseOrders } = storeToRefs(usePurchaseOrderStore())

const rows = computed(() =>
  orders.value
    .filter((o) => !wfStore.isDraftStatus(o.status))
    .map((o) => {
      const open = o.contractAmount - o.receivedAmount
      const totalQty = Math.max(0, Number(o.totalQty) || 0)
      const shippedQty = Math.max(0, Number(o.shippedQty) || 0)
      return {
        id: o.id,
        customer: o.customer,
        contract: o.contractAmount,
        received: o.receivedAmount,
        open,
        status: open <= 0 ? '待结案' : '未结清',
        totalQty,
        shippedQty,
        moStatus: o.status,
        shipComplete: isProductionOrderFullyShipped(o),
        closeReady: isProductionOrderReadyForCaseClose(o),
        moClosed: wfStore.isClosedStatus(o.status),
        receiveLocked: isProductionOrderReceivedAmountLocked(o),
      }
    })
    .filter((r) => !kw.value.trim() || r.customer.includes(kw.value.trim())),
)

const receiveDialogVisible = ref(false)
const receiveDialogOrderId = ref('')
const receiveDialogDraft = ref(0)
const receiveDialogOrder = computed(() => orders.value.find((o) => o.id === receiveDialogOrderId.value) || null)
const receiveDialogContract = computed(() => Math.max(0, Number(receiveDialogOrder.value?.contractAmount) || 0))

function openReceiveDialog(row) {
  if (!rolesStore.can('finance') && !rolesStore.canViewOrderFinancials()) return
  const o = orders.value.find((x) => x.id === row.id)
  if (!o) return
  if (isProductionOrderReceivedAmountLocked(o)) {
    ElMessage.warning('本单已结案，已回款不可再改')
    return
  }
  receiveDialogOrderId.value = row.id
  receiveDialogDraft.value = Math.max(0, Number(o.receivedAmount) || 0)
  receiveDialogVisible.value = true
}

function confirmReceiveDialog() {
  const id = receiveDialogOrderId.value
  if (!id) return
  const r = poStore.setOrderReceivedAmount(id, receiveDialogDraft.value)
  if (!r?.ok) {
    ElMessage.warning(r?.message || '保存失败')
    return
  }
  ElMessage.success('已更新已回款')
  receiveDialogVisible.value = false
}

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

function closeApplyEnabled(row) {
  return !!row?.closeReady && rolesStore.can('action_finance_apply_close')
}

function closeApplyTooltip(row) {
  if (!row?.shipComplete) {
    return `须全部出货后方可申请结案（当前已出 ${row.shippedQty} / ${row.totalQty} 台）`
  }
  if (!row?.closeReady) {
    const st = row.moStatus || '—'
    return `须生产订单状态为「已出货」后方可申请结案（出货页登记满台数后会自动从「待出货」转入；当前为「${st}」）`
  }
  if (row.open > 0) {
    return `须回款结清（未收为 ¥0）后方可申请结案；当前未收 ¥${row.open.toLocaleString()}`
  }
  if (!rolesStore.can('action_finance_apply_close')) {
    return permissionTip('action_finance_apply_close')
  }
  return '点击后生成一条「结案审批」待办，厂长（或具备结案审批权限的角色）在审批中心处理'
}

function goClose(row) {
  if (!rolesStore.can('action_finance_apply_close')) {
    ElMessage.warning(permissionTip('action_finance_apply_close'))
    return
  }
  if (!row?.id) return
  const order = orders.value.find((o) => o.id === row.id)
  if (!isProductionOrderReadyForCaseClose(order)) {
    if (!isProductionOrderFullyShipped(order)) {
      const t = Math.max(0, Number(order?.totalQty) || 0)
      const s = Math.max(0, Number(order?.shippedQty) || 0)
      ElMessage.warning(`须全部出货后方可申请结案（当前已出 ${s} / ${t} 台）`)
    } else {
      ElMessage.warning(
        `须生产订单状态为「已出货」后方可申请结案（出货确认登记满台数后自动转入；当前为「${order?.status || '—'}」）`,
      )
    }
    return
  }
  if (wfStore.isClosedStatus(order?.status)) {
    ElMessage.warning('该订单已结案')
    return
  }
  if (row.open > 0) {
    ElMessage.warning(`须回款结清后方可申请结案（当前未收 ¥${row.open.toLocaleString()}）`)
    return
  }
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
.nf-mt {
  margin-top: 10px;
}
</style>
