<template>
  <div class="nf-page" v-if="item">
    <el-page-header @back="$router.push('/approval')" content="审批处理" class="nf-back" />
    <el-card shadow="never" class="nf-row-mt">
      <el-descriptions title="单据信息" :column="2" border>
        <el-descriptions-item label="审批类型">{{ item.type }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="item.status === '待审批' ? 'warning' : 'success'">{{ item.status }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="关联单号">{{ item.ref }}</el-descriptions-item>
        <el-descriptions-item label="客户/摘要">{{ item.customer }}</el-descriptions-item>
        <el-descriptions-item label="提交人">{{ item.submitter }}</el-descriptions-item>
        <el-descriptions-item label="提交时间">{{ item.time }}</el-descriptions-item>
      </el-descriptions>
      <el-divider />
      <p v-if="item.type === '结案审批'" class="nf-muted">
        结案类审批：需具备「{{ approvalPermissionTitle(item) }}」。
      </p>
      <p v-else-if="item.type === '采购申请'" class="nf-muted">
        采购申请：需具备「{{ approvalPermissionTitle(item) }}」。
      </p>
      <p v-else-if="item.type === '采购单财务审核'" class="nf-muted">
        采购单财务审核：需具备「{{ approvalPermissionTitle(item) }}」；同意后采购单财务状态为「已通过」。
      </p>
      <template v-if="item.type === '采购单财务审核' && po">
        <el-divider />
        <el-descriptions title="采购订单信息" :column="2" border>
          <el-descriptions-item label="采购单号">{{ po.id }}</el-descriptions-item>
          <el-descriptions-item label="执行状态">{{ po.status }}</el-descriptions-item>
          <el-descriptions-item label="供应商">{{ po.supplier || '—' }}</el-descriptions-item>
          <el-descriptions-item label="财务审核状态">{{ po.financeAuditStatus || '未提交' }}</el-descriptions-item>
          <el-descriptions-item label="供应商联系人">{{ supplierInfo?.contact || '—' }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ supplierInfo?.phone || '—' }}</el-descriptions-item>
          <el-descriptions-item label="交期参考">{{ supplierInfo?.leadDays ? `${supplierInfo.leadDays} 天` : '—' }}</el-descriptions-item>
          <el-descriptions-item label="付款条件">{{ supplierInfo?.paymentTerms || '—' }}</el-descriptions-item>
          <el-descriptions-item label="供应商评级">
            <el-tag :type="ratingTagType(supplierPerf.rating)" size="small">{{ supplierPerf.rating }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="历史逾期率">{{ supplierPerf.overdueRate.toFixed(1) }}%</el-descriptions-item>
          <el-descriptions-item label="采购总额">¥{{ poTotalAmount.toLocaleString() }}</el-descriptions-item>
          <el-descriptions-item label="已付款">¥{{ poPaidAmount.toLocaleString() }}</el-descriptions-item>
          <el-descriptions-item label="待付款">¥{{ poOpenAmount.toLocaleString() }}</el-descriptions-item>
          <el-descriptions-item label="到货进度">{{ arrivedQty }} / {{ orderedQty }}</el-descriptions-item>
        </el-descriptions>
        <h4 class="nf-h4">采购明细</h4>
        <el-table :data="po.lines || []" stripe>
          <el-table-column type="index" width="50" />
          <el-table-column prop="materialCode" label="物料编码" width="110" />
          <el-table-column prop="desc" label="物料" min-width="140" />
          <el-table-column prop="spec" label="规格" width="100" />
          <el-table-column prop="qty" label="下单数量" width="88" align="right" />
          <el-table-column prop="receivedQty" label="已到货" width="88" align="right" />
          <el-table-column prop="unit" label="单位" width="70" />
          <el-table-column prop="price" label="单价" width="90" align="right">
            <template #default="{ row }">¥{{ (Number(row.price) || 0).toLocaleString() }}</template>
          </el-table-column>
          <el-table-column prop="amount" label="金额" width="100" align="right">
            <template #default="{ row }">¥{{ (Number(row.amount) || 0).toLocaleString() }}</template>
          </el-table-column>
          <el-table-column prop="due" label="交期" width="110" />
        </el-table>
        <h4 class="nf-h4">到货记录</h4>
        <el-table :data="po.arrivals || []" stripe>
          <el-table-column prop="batch" label="批次" width="70" />
          <el-table-column prop="materialCode" label="物料编码" width="110" />
          <el-table-column prop="material" label="物料" min-width="120" />
          <el-table-column prop="qty" label="到货数量" width="100" align="right" />
          <el-table-column prop="date" label="到货日期" width="110" />
          <el-table-column prop="by" label="登记人" width="90" />
          <el-table-column prop="note" label="备注" min-width="120" />
        </el-table>
      </template>
      <template v-else-if="item.type === '采购申请' && purchaseRequest">
        <el-divider />
        <el-descriptions title="采购申请信息" :column="2" border>
          <el-descriptions-item label="申请单号">{{ purchaseRequest.id }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ purchaseRequest.status }}</el-descriptions-item>
          <el-descriptions-item label="关联生产单">{{ purchaseRequest.productionOrderId }}</el-descriptions-item>
          <el-descriptions-item label="申请人">{{ purchaseRequest.applicant }}</el-descriptions-item>
        </el-descriptions>
        <h4 class="nf-h4">申请明细</h4>
        <el-table :data="purchaseRequest.lines || []" stripe>
          <el-table-column type="index" width="50" />
          <el-table-column prop="materialCode" label="物料编码" width="110" />
          <el-table-column prop="desc" label="物料" min-width="120" />
          <el-table-column prop="spec" label="规格" width="100" />
          <el-table-column prop="qty" label="数量" width="80" align="right" />
          <el-table-column prop="unit" label="单位" width="70" />
          <el-table-column prop="supplier" label="建议供应商" width="120" />
          <el-table-column prop="needDate" label="需求日期" width="110" />
        </el-table>
      </template>
      <div class="nf-actions" v-if="item.status === '待审批' && rolesStore.canProcessApproval(item)">
        <el-button type="danger" plain @click="onReject">退回</el-button>
        <el-button type="primary" @click="onApprove">{{ approveLabel }}</el-button>
      </div>
      <p v-else-if="item.status === '待审批'" class="nf-warn">{{ approvalPermissionTip(item) }}</p>
    </el-card>
  </div>
  <el-empty v-else description="未找到审批单" />
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useApprovalsStore } from '@/stores/approvals'
import { usePurchaseOrderStore } from '@/stores/purchaseOrders'
import { useRolesStore } from '@/stores/roles'
import { usePurchaseRequestStore } from '@/stores/purchaseRequests'
import { useSupplierStore } from '@/stores/suppliers'
import { approvalPermissionTip, approvalPermissionTitle } from '@/utils/approvalPermission'

const route = useRoute()
const router = useRouter()
const rolesStore = useRolesStore()
const approvalsStore = useApprovalsStore()
const purchaseStore = usePurchaseOrderStore()
const requestStore = usePurchaseRequestStore()
const supplierStore = useSupplierStore()

const item = computed(() => approvalsStore.findById(route.params.id))
const po = computed(() => (item.value?.type === '采购单财务审核' ? purchaseStore.getById(item.value.ref) : null))
const supplierInfo = computed(() => (po.value ? purchaseStore.supplierSnapshot(po.value) || supplierStore.findByName(po.value.supplier) : null))
const purchaseRequest = computed(() => (item.value?.type === '采购申请' ? requestStore.getById(item.value.ref) : null))
const poTotalAmount = computed(() => Number(po.value?.totalAmount) || 0)
const poPaidAmount = computed(() => Number(po.value?.paidAmount) || 0)
const poOpenAmount = computed(() => Math.max(0, poTotalAmount.value - poPaidAmount.value))
const orderedQty = computed(() => (po.value?.lines || []).reduce((s, l) => s + (Number(l.qty) || 0), 0))
const arrivedQty = computed(() => (po.value?.lines || []).reduce((s, l) => s + (Number(l.receivedQty) || 0), 0))
const supplierPerf = computed(() => {
  const sup = supplierInfo.value
  if (!sup) return { rating: '—', overdueRate: 0 }
  const today = new Date().toISOString().slice(0, 10)
  const matchedPos = purchaseStore.orders.filter(
    (x) => (sup.id && x.supplierId === sup.id) || String(x.supplier || '').trim() === String(sup.name || '').trim(),
  )
  let lineCount = 0
  let overdueCount = 0
  for (const one of matchedPos) {
    const arrivals = one.arrivals || []
    for (let i = 0; i < (one.lines || []).length; i += 1) {
      const line = one.lines[i]
      const due = String(line?.due || '')
      if (!due) continue
      lineCount += 1
      const target = Number(line?.qty) || 0
      const received = Number(line?.receivedQty) || 0
      if (received >= target) {
        const arr = arrivals
          .filter((a) => Number(a?.lineIndex) === i)
          .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
        let sum = 0
        let finishDate = ''
        for (const a of arr) {
          sum += Number(a?.qty) || 0
          if (sum >= target) {
            finishDate = String(a?.date || '')
            break
          }
        }
        if (finishDate && finishDate > due) overdueCount += 1
      } else if (today > due) {
        overdueCount += 1
      }
    }
  }
  const overdueRate = lineCount > 0 ? (overdueCount / lineCount) * 100 : 0
  const rating = overdueRate <= 5 ? 'A' : overdueRate <= 15 ? 'B' : overdueRate <= 30 ? 'C' : 'D'
  return { rating, overdueRate }
})

const approveLabel = computed(() => {
  const t = item.value?.type
  if (t === '采购申请') return '同意（采购申请）'
  if (t === '采购单财务审核') return '同意（财务审核）'
  return '同意结案'
})

async function onApprove() {
  if (!rolesStore.canProcessApproval(item.value)) {
    ElMessage.warning(approvalPermissionTip(item.value))
    return
  }
  await ElMessageBox.confirm('确认同意？', '提示', { type: 'warning' })
  const cur = item.value
  if (!cur) return
  if (cur.type === '采购申请') {
    requestStore.setStatus(cur.ref, '已通过')
  }
  if (cur.type === '采购单财务审核') {
    purchaseStore.setFinanceAudit(cur.ref, '已通过')
  }
  approvalsStore.setStatus(cur.id, '已通过')
  ElMessage.success('已审批通过')
  router.push('/approval')
}

function onReject() {
  if (!rolesStore.canProcessApproval(item.value)) {
    ElMessage.warning(approvalPermissionTip(item.value))
    return
  }
  const cur = item.value
  if (!cur) return
  if (cur.type === '采购申请') {
    requestStore.setStatus(cur.ref, '已退回')
  }
  if (cur.type === '采购单财务审核') {
    purchaseStore.setFinanceAudit(cur.ref, '已驳回')
  }
  approvalsStore.setStatus(cur.id, '已退回')
  ElMessage.warning('已退回')
  router.push('/approval')
}

function ratingTagType(rating) {
  if (rating === 'A') return 'success'
  if (rating === 'B') return 'primary'
  if (rating === 'C') return 'warning'
  if (rating === 'D') return 'danger'
  return 'info'
}
</script>

<style scoped>
.nf-page {
  max-width: 720px;
  margin: 0 auto;
}
.nf-back :deep(.el-page-header__content) {
  font-weight: 600;
}
.nf-row-mt {
  margin-top: 16px;
}
.nf-muted {
  color: #6b7280;
  font-size: 13px;
  line-height: 1.6;
}
.nf-warn {
  margin-top: 12px;
  font-size: 13px;
  color: #b45309;
  line-height: 1.5;
}
.nf-actions {
  margin-top: 20px;
  display: flex;
  gap: 12px;
}
.nf-h4 {
  margin: 16px 0 10px;
  font-size: 14px;
  font-weight: 600;
}
</style>
