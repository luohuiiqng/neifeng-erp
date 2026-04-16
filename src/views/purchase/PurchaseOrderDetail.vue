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
        <el-descriptions-item label="供应商联系人">{{ supplierInfo?.contact || '—' }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{ supplierInfo?.phone || '—' }}</el-descriptions-item>
        <el-descriptions-item label="付款条件">{{ supplierInfo?.paymentTerms || '—' }}</el-descriptions-item>
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
        <el-table-column prop="materialCode" label="物料编码" width="110" />
        <el-table-column prop="desc" label="物料描述" min-width="160" />
        <el-table-column prop="spec" label="规格" width="110" />
        <el-table-column prop="qty" label="数量" width="72" />
        <el-table-column prop="receivedQty" label="已到货" width="88" />
        <el-table-column label="未到货" width="88">
          <template #default="{ row }">{{ Math.max(0, (Number(row.qty) || 0) - (Number(row.receivedQty) || 0)) }}</template>
        </el-table-column>
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
      <div class="nf-kpis">
        <el-tag type="info" effect="plain">下单数量：{{ orderedQty }}</el-tag>
        <el-tag :type="arrivedQty >= orderedQty && orderedQty > 0 ? 'success' : 'warning'" effect="plain">
          已到货：{{ arrivedQty }}
        </el-tag>
        <el-tag type="danger" effect="plain">未到货：{{ pendingQty }}</el-tag>
        <el-tag v-if="rolesStore.canViewOrderFinancials()" type="warning" effect="plain">
          待付款：¥{{ payableOpen.toLocaleString() }}
        </el-tag>
      </div>

      <h4 class="nf-h4">到货登记</h4>
      <p class="nf-muted nf-mb">不做库存账务校验，仅记录批次与数量。</p>
      <el-table :data="po.arrivals" stripe border>
        <el-table-column prop="batch" label="批次" width="72" />
        <el-table-column prop="materialCode" label="物料编码" width="110" />
        <el-table-column prop="material" label="物料" min-width="120" />
        <el-table-column prop="date" label="到货日期" width="120" />
        <el-table-column prop="qty" label="到货数量" width="100" />
        <el-table-column prop="by" label="登记人" width="100" />
        <el-table-column prop="note" label="备注" min-width="140" />
      </el-table>
      <div class="nf-form-grid">
        <el-select v-model="arrivalForm.lineIndex" placeholder="选择物料" style="width: 100%">
          <el-option
            v-for="opt in arrivalLineOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <el-date-picker v-model="arrivalForm.date" value-format="YYYY-MM-DD" type="date" placeholder="到货日期" />
        <el-input-number v-model="arrivalForm.qty" :min="1" :max="maxArrivalQty" />
        <el-input v-model="arrivalForm.by" placeholder="登记人" />
        <el-input v-model="arrivalForm.note" placeholder="备注（可选）" />
        <el-button type="primary" @click="onAddArrival">登记到货</el-button>
      </div>

      <div class="nf-actions">
        <el-button v-if="canClosePo" type="danger" plain @click="onSetPoStatus('已关闭')">关闭采购单</el-button>
        <el-button v-if="canResumePo" @click="onSetPoStatus('执行中')">恢复执行</el-button>
        <el-button v-if="canFinishPo" type="success" @click="onSetPoStatus('已完成')">标记采购完成</el-button>
        <el-tooltip
          v-if="canSubmitFinance"
          :disabled="rolesStore.can('action_po_submit_finance')"
          :content="permissionTip('action_po_submit_finance')"
          placement="top"
        >
          <span>
            <el-button
              type="warning"
              :disabled="!rolesStore.can('action_po_submit_finance') || !canSubmitFinance"
              @click="onSubmitFinance"
            >
              提交财务审核
            </el-button>
          </span>
        </el-tooltip>
        <el-input-number
          v-if="rolesStore.can('finance') && rolesStore.canViewOrderFinancials()"
          v-model="payAmount"
          :min="0"
          :max="payableOpen"
          :step="100"
        />
        <el-button
          v-if="rolesStore.can('finance') && rolesStore.canViewOrderFinancials()"
          :disabled="!payAmount"
          @click="onRecordPayment"
        >
          登记付款
        </el-button>
      </div>
      <p v-if="rolesStore.can('action_finance_audit_po') && po.financeAuditStatus === '待财务审核'" class="nf-muted nf-mt">
        已生成审批中心待办，请财务在「审批中心」处理。
      </p>
      <p v-if="po.status === '已关闭'" class="nf-muted nf-mt">该采购单已关闭，不能继续登记到货；可恢复执行后继续。</p>
      <p v-if="po.status === '已完成'" class="nf-muted nf-mt">该采购单已完成，流程结束。</p>
    </el-card>
  </div>
  <el-empty v-else description="未找到采购订单" />
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { usePurchaseOrderStore } from '@/stores/purchaseOrders'
import { useApprovalsStore } from '@/stores/approvals'
import { useRolesStore } from '@/stores/roles'
import { useSupplierStore } from '@/stores/suppliers'
import { permissionTip } from '@/utils/permissionMeta'

const route = useRoute()
const purchaseStore = usePurchaseOrderStore()
const approvalsStore = useApprovalsStore()
const rolesStore = useRolesStore()
const supplierStore = useSupplierStore()

const po = computed(() => purchaseStore.getById(route.params.id))
const orderedQty = computed(() => (po.value?.lines || []).reduce((s, l) => s + (Number(l.qty) || 0), 0))
const arrivedQty = computed(() => (po.value?.arrivals || []).reduce((s, a) => s + (Number(a.qty) || 0), 0))
const pendingQty = computed(() => Math.max(0, orderedQty.value - arrivedQty.value))
const arrivalLineOptions = computed(() => {
  const lines = po.value?.lines || []
  return lines
    .map((l, idx) => {
      const pending = Math.max(0, (Number(l.qty) || 0) - (Number(l.receivedQty) || 0))
      return {
        value: idx,
        pending,
        label: `${l.materialCode || '未编码'} · ${l.desc || '未命名'}（未到货${pending}${l.unit || '件'}）`,
      }
    })
    .filter((x) => x.pending > 0)
})
const selectedArrivalLine = computed(() => {
  const idx = Number(arrivalForm.lineIndex)
  if (!Number.isInteger(idx) || !po.value?.lines?.[idx]) return null
  return po.value.lines[idx]
})
const maxArrivalQty = computed(() => {
  const line = selectedArrivalLine.value
  if (!line) return 1
  return Math.max(1, (Number(line.qty) || 0) - (Number(line.receivedQty) || 0))
})
const totalAmount = computed(() => Number(po.value?.totalAmount) || 0)
const paidAmount = computed(() => Number(po.value?.paidAmount) || 0)
const payableOpen = computed(() => Math.max(0, totalAmount.value - paidAmount.value))
const supplierInfo = computed(() => (po.value ? purchaseStore.supplierSnapshot(po.value) || supplierStore.findByName(po.value.supplier) : null))
const payAmount = ref(0)
const arrivalForm = reactive({
  lineIndex: '',
  date: '',
  qty: 1,
  by: '',
  note: '',
})
watch(
  arrivalLineOptions,
  (opts) => {
    if (!opts.length) {
      arrivalForm.lineIndex = ''
      return
    }
    if (!opts.some((o) => o.value === arrivalForm.lineIndex)) {
      arrivalForm.lineIndex = opts[0].value
      arrivalForm.qty = 1
    }
  },
  { immediate: true },
)

const canSubmitFinance = computed(() => {
  const s = po.value?.financeAuditStatus
  return s === '未提交' || s === '已驳回' || !s
})
const canClosePo = computed(() => po.value && !['已关闭', '已完成'].includes(po.value.status))
const canResumePo = computed(() => po.value?.status === '已关闭')
const canFinishPo = computed(() => po.value?.status === '已到货')

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

function onAddArrival() {
  if (!po.value) return
  if (po.value.status === '已关闭' || po.value.status === '已完成') {
    ElMessage.warning('当前状态不能登记到货')
    return
  }
  if (!arrivalForm.date) {
    ElMessage.warning('请选择到货日期')
    return
  }
  if (arrivalForm.lineIndex === '') {
    ElMessage.warning('请选择到货物料')
    return
  }
  const ok = purchaseStore.addArrival(po.value.id, {
    lineIndex: arrivalForm.lineIndex,
    date: arrivalForm.date,
    qty: arrivalForm.qty,
    by: arrivalForm.by || rolesStore.currentRole?.name || '采购',
    note: arrivalForm.note,
  })
  if (!ok) {
    ElMessage.warning('登记失败，请检查物料与数量')
    return
  }
  arrivalForm.qty = 1
  arrivalForm.note = ''
  ElMessage.success('已登记到货')
}

function onSetPoStatus(next) {
  if (!po.value) return
  const r = purchaseStore.setExecutionStatus(po.value.id, next)
  if (!r.ok) {
    ElMessage.warning(r.message || '状态更新失败')
    return
  }
  ElMessage.success(`采购单状态已更新为「${next}」`)
}

function onRecordPayment() {
  if (!po.value) return
  const ok = purchaseStore.recordPayment(po.value.id, payAmount.value)
  if (!ok) {
    ElMessage.warning('付款登记失败')
    return
  }
  ElMessage.success('已登记付款')
  payAmount.value = 0
}

function onSubmitFinance() {
  if (!po.value) return
  if (!rolesStore.can('action_po_submit_finance')) {
    ElMessage.warning(permissionTip('action_po_submit_finance'))
    return
  }
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
  align-items: center;
}
.nf-kpis {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.nf-form-grid {
  margin-top: 10px;
  display: grid;
  gap: 8px;
  grid-template-columns: 230px 150px 120px 130px 1fr auto;
}
</style>
