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
      <template v-else-if="item.type === '结案审批'">
        <el-divider />
        <template v-if="closeOrder">
          <p v-if="closeCaseGuardText" class="nf-warn nf-close-guard">{{ closeCaseGuardText }}</p>
          <el-descriptions title="关联生产订单" :column="2" border>
            <el-descriptions-item label="生产单号">
              <router-link :to="`/production-orders/${closeOrder.id}`" class="nf-link">{{ closeOrder.id }}</router-link>
            </el-descriptions-item>
            <el-descriptions-item label="订单状态">
              <el-tag :type="workflowStore.tagTypeFor(closeOrder.status)" size="small">{{ closeOrderStatusLabel }}</el-tag>
              <el-tag v-if="closeOrder.customerType === '出口'" type="warning" size="small" class="nf-tag-gap">出口</el-tag>
              <el-tag v-if="closeStatusDef?.showShipPendingExtra" type="warning" size="small" class="nf-tag-gap">待厂长出货审批</el-tag>
              <el-tag
                v-else-if="closeStatusDef?.showShipReleaseExtra"
                :type="closeOrder.shipReleaseApproved ? 'success' : 'info'"
                size="small"
                class="nf-tag-gap"
              >
                {{
                  closeOrder.shipReleaseApproved
                    ? `已同意出货${closeOrder.shipReleaseBy ? `·${closeOrder.shipReleaseBy}` : ''}`
                    : '待厂长同意出货'
                }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="客户/项目">{{ closeOrder.customer }}</el-descriptions-item>
            <el-descriptions-item label="类型">{{ closeOrder.customerType }}</el-descriptions-item>
            <el-descriptions-item label="下达日期">{{ closeOrder.signedAt }}</el-descriptions-item>
            <el-descriptions-item label="要求交期">{{ closeOrder.dueDate }}</el-descriptions-item>
            <el-descriptions-item label="创建人">{{ closeOrder.owner }}</el-descriptions-item>
            <el-descriptions-item label="分批出货">{{ closeOrder.allowPartialShip ? '允许' : '不允许' }}</el-descriptions-item>
            <el-descriptions-item label="订单台数">{{ closeOrder.totalQty }}</el-descriptions-item>
            <el-descriptions-item label="已出货台数">{{ closeOrder.shippedQty ?? 0 }}</el-descriptions-item>
            <template v-if="rolesStore.canViewOrderFinancials()">
              <el-descriptions-item label="合同金额">¥{{ (Number(closeOrder.contractAmount) || 0).toLocaleString() }}</el-descriptions-item>
              <el-descriptions-item label="已回款">¥{{ (Number(closeOrder.receivedAmount) || 0).toLocaleString() }}</el-descriptions-item>
              <el-descriptions-item label="未回款">¥{{ closeOrderOpenAmount.toLocaleString() }}</el-descriptions-item>
              <el-descriptions-item label="本单采购（关联采购单合计）">
                ¥{{ purchaseTotalForCloseOrder.toLocaleString() }}
              </el-descriptions-item>
            </template>
            <el-descriptions-item v-else label="金额信息" :span="2">
              <span class="nf-muted">合同金额、回款及本单采购合计仅厂长（及管理员）可见。</span>
            </el-descriptions-item>
          </el-descriptions>
          <h4 class="nf-h4">订单明细</h4>
          <el-table :data="closeOrder.lines || []" stripe border>
            <el-table-column type="index" label="#" width="50" />
            <el-table-column prop="unit" label="单位名称" min-width="120" />
            <el-table-column prop="model" label="机型" min-width="160" />
            <el-table-column prop="temp" label="冷/热" width="80" />
            <el-table-column prop="stitch" label="缝包" width="88" />
            <el-table-column prop="qty" label="台数" width="72" align="center" />
            <el-table-column prop="punch" label="打孔" width="80" />
            <el-table-column label="备注摘要" min-width="140" show-overflow-tooltip>
              <template #default="{ row }">{{ lineRemarkSummary(row) }}</template>
            </el-table-column>
          </el-table>
          <h4 class="nf-h4">生产备注（主单）</h4>
          <p v-if="!sortedCloseRemarkEntries.length" class="nf-muted">暂无主单备注。</p>
          <div v-else class="nf-remark-log">
            <div
              v-for="e in sortedCloseRemarkEntries"
              :key="e.id"
              :class="['nf-remark-item', e.priority === 'high' ? 'nf-remark-item--high' : '', e.done ? 'nf-remark-item--done' : '']"
            >
              <div class="nf-remark-meta">
                <span>{{ e.createdAt }} · {{ e.createdBy }}</span>
                <el-tag v-if="e.priority === 'high'" type="danger" size="small" effect="dark">高优先级</el-tag>
                <el-tag v-if="e.done" type="success" size="small" effect="plain">已完成</el-tag>
                <el-tag v-else type="info" size="small" effect="plain">进行中</el-tag>
              </div>
              <div class="nf-remark-text">{{ e.text }}</div>
            </div>
          </div>
        </template>
        <p v-else class="nf-warn">未找到关联生产订单「{{ item.ref }}」，无法展示结案上下文。</p>
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
      <p v-if="item.status === '待审批' && rolesStore.canProcessApproval(item)" class="nf-muted nf-reject-tip">
        退回须填写原因；能关联到生产订单时，将<strong>自动追加</strong>至该单主备注（<strong>高优先级</strong>）。
      </p>
      <div class="nf-actions" v-if="item.status === '待审批' && rolesStore.canProcessApproval(item)">
        <el-button type="danger" plain @click="onReject">退回</el-button>
        <el-button type="primary" :disabled="closeApproveDisabled" @click="onApprove">{{ approveLabel }}</el-button>
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
import { useProductionOrderStore } from '@/stores/productionOrders'
import { useOrderWorkflowStore } from '@/stores/orderWorkflow'
import { approvalPermissionTip, approvalPermissionTitle } from '@/utils/approvalPermission'
import { isProductionOrderFullyShipped, isProductionOrderReadyForCaseClose } from '@/utils/orderCloseRules'

const route = useRoute()
const router = useRouter()
const rolesStore = useRolesStore()
const approvalsStore = useApprovalsStore()
const purchaseStore = usePurchaseOrderStore()
const requestStore = usePurchaseRequestStore()
const supplierStore = useSupplierStore()
const productionStore = useProductionOrderStore()
const workflowStore = useOrderWorkflowStore()

const item = computed(() => approvalsStore.findById(route.params.id))
const po = computed(() => (item.value?.type === '采购单财务审核' ? purchaseStore.getById(item.value.ref) : null))
const supplierInfo = computed(() => (po.value ? purchaseStore.supplierSnapshot(po.value) || supplierStore.findByName(po.value.supplier) : null))
const purchaseRequest = computed(() => (item.value?.type === '采购申请' ? requestStore.getById(item.value.ref) : null))
const closeOrder = computed(() => {
  if (item.value?.type !== '结案审批') return null
  return productionStore.orders.find((o) => o.id === item.value.ref) || null
})
const closeStatusDef = computed(() => (closeOrder.value ? workflowStore.statusByCode(closeOrder.value.status) : null))
const closeOrderStatusLabel = computed(() => {
  if (!closeOrder.value) return ''
  return closeStatusDef.value?.name || closeOrder.value.status
})
const closeOrderOpenAmount = computed(() => {
  const o = closeOrder.value
  if (!o) return 0
  const c = Number(o.contractAmount) || 0
  const r = Number(o.receivedAmount) || 0
  return Math.max(0, c - r)
})
const purchaseTotalForCloseOrder = computed(() => {
  const o = closeOrder.value
  if (!o || !rolesStore.canViewOrderFinancials()) return 0
  return purchaseStore.sumAmountForProductionOrder(o.id)
})
const sortedCloseRemarkEntries = computed(() => {
  const list = Array.isArray(closeOrder.value?.remarkEntries) ? [...closeOrder.value.remarkEntries] : []
  return list.sort((a, b) => {
    const ta = `${a.createdAt || ''}\t${a.id || ''}`
    const tb = `${b.createdAt || ''}\t${b.id || ''}`
    return ta.localeCompare(tb)
  })
})

const closeShippedDisplay = computed(() => Math.max(0, Number(closeOrder.value?.shippedQty) || 0))
const closeTotalDisplay = computed(() => Math.max(0, Number(closeOrder.value?.totalQty) || 0))

const closeCaseGuardText = computed(() => {
  if (item.value?.type !== '结案审批' || item.value?.status !== '待审批' || !closeOrder.value) return ''
  const o = closeOrder.value
  if (!isProductionOrderReadyForCaseClose(o)) {
    if (!isProductionOrderFullyShipped(o)) {
      return `须全部出货后方可同意结案；本单已出 ${closeShippedDisplay.value} / ${closeTotalDisplay.value} 台。不符合条件时请使用「退回」。`
    }
    return `台数已出齐，但生产状态为「${o.status || '—'}」，须为「已出货」后方可同意结案（出货确认登记满台数后会自动从「待出货」转入）。不符合条件时请使用「退回」。`
  }
  return ''
})

const closeApproveDisabled = computed(() => {
  if (item.value?.type !== '结案审批') return false
  const o = closeOrder.value
  if (!o) return true
  return !isProductionOrderReadyForCaseClose(o)
})
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
  const cur = item.value
  if (!cur) return
  if (cur.type === '结案审批') {
    const o = productionStore.orders.find((x) => x.id === cur.ref)
    if (!o) {
      ElMessage.warning('未找到关联生产订单，无法同意结案')
      return
    }
    if (!isProductionOrderReadyForCaseClose(o)) {
      if (!isProductionOrderFullyShipped(o)) {
        const t = Math.max(0, Number(o.totalQty) || 0)
        const s = Math.max(0, Number(o.shippedQty) || 0)
        ElMessage.warning(`须全部出货后方可同意结案（当前已出 ${s} / ${t} 台）`)
      } else {
        ElMessage.warning(
          `须生产订单状态为「已出货」后方可同意结案（出货确认登记满台数后自动转入；当前为「${o.status || '—'}」）`,
        )
      }
      return
    }
  }
  await ElMessageBox.confirm('确认同意？', '提示', { type: 'warning' })
  if (cur.type === '采购申请') {
    requestStore.setStatus(cur.ref, '已通过')
  }
  if (cur.type === '采购单财务审核') {
    purchaseStore.setFinanceAudit(cur.ref, '已通过')
  }
  if (cur.type === '结案审批' && productionStore.orders.some((o) => o.id === cur.ref)) {
    productionStore.setOrderStatus(cur.ref, '已结案')
  }
  approvalsStore.setStatus(cur.id, '已通过')
  ElMessage.success('已审批通过')
  router.push('/approval')
}

function resolveProductionOrderIdFromApproval(cur) {
  if (!cur) return ''
  if (cur.type === '结案审批') return String(cur.ref || '').trim()
  if (cur.type === '采购申请') {
    const pr = requestStore.getById(cur.ref)
    return String(pr?.productionOrderId || '').trim()
  }
  if (cur.type === '采购单财务审核') {
    const po = purchaseStore.getById(cur.ref)
    const rid = String(po?.requestId || '').trim()
    if (!rid) return ''
    const pr = requestStore.getById(rid)
    return String(pr?.productionOrderId || '').trim()
  }
  return ''
}

function appendApprovalRejectRemark(moId, approvalTypeLabel, reason, byName) {
  const id = String(moId || '').trim()
  const text = String(reason || '').trim()
  if (!id || !text) return
  const o = productionStore.orders.find((x) => x.id === id)
  if (!o) return
  productionStore.appendRemark(id, {
    text: `[审批退回·${approvalTypeLabel}] ${text}`,
    priority: 'high',
    by: String(byName || '—').trim() || '—',
  })
}

async function onReject() {
  if (!rolesStore.canProcessApproval(item.value)) {
    ElMessage.warning(approvalPermissionTip(item.value))
    return
  }
  const cur = item.value
  if (!cur) return
  let reason = ''
  try {
    const { value } = await ElMessageBox.prompt('请说明退回原因（将写入关联生产订单主备注，高优先级）。', '填写退回原因', {
      confirmButtonText: '确认退回',
      cancelButtonText: '取消',
      inputType: 'textarea',
      inputPlaceholder: '退回原因不能为空',
      inputValidator: (val) => {
        const s = String(val || '').trim()
        if (!s) return '请填写退回原因'
        if (s.length > 2000) return '退回原因过长'
        return true
      },
    })
    reason = String(value || '').trim()
  } catch {
    return
  }
  if (!reason) return

  if (cur.type === '采购申请') {
    requestStore.setStatus(cur.ref, '已退回')
  }
  if (cur.type === '采购单财务审核') {
    purchaseStore.setFinanceAudit(cur.ref, '已驳回')
  }
  approvalsStore.setStatus(cur.id, '已退回')

  const moId = resolveProductionOrderIdFromApproval(cur)
  const by = rolesStore.currentRole?.name || '—'
  if (moId) {
    appendApprovalRejectRemark(moId, cur.type, reason, by)
    ElMessage.warning('已退回，并已记入生产订单备注')
  } else {
    ElMessage.warning('已退回（未关联到生产订单，未写入订单备注）')
  }
  router.push('/approval')
}

function ratingTagType(rating) {
  if (rating === 'A') return 'success'
  if (rating === 'B') return 'primary'
  if (rating === 'C') return 'warning'
  if (rating === 'D') return 'danger'
  return 'info'
}

function sortedLineRemarksForClose(row) {
  const list = Array.isArray(row?.noteRemarkEntries) ? [...row.noteRemarkEntries] : []
  return list.sort((a, b) => {
    const ta = `${a.createdAt || ''}\t${a.id || ''}`
    const tb = `${b.createdAt || ''}\t${b.id || ''}`
    return ta.localeCompare(tb)
  })
}

function lineRemarkSummary(row) {
  const legacy = typeof row?.note === 'string' ? row.note.trim() : ''
  const arr = sortedLineRemarksForClose(row)
  if (!arr.length) return legacy || '—'
  const hasHigh = arr.some((e) => e.priority === 'high')
  const last = arr[arr.length - 1]
  const t = last.text || ''
  const short = t.length > 40 ? `${t.slice(0, 40)}…` : t
  return `${hasHigh ? '【含高优先级】' : ''}${short}`
}
</script>

<style scoped>
.nf-page {
  max-width: 960px;
  margin: 0 auto;
}
.nf-link {
  color: var(--el-color-primary);
  font-weight: 600;
  text-decoration: none;
}
.nf-link:hover {
  text-decoration: underline;
}
.nf-tag-gap {
  margin-left: 6px;
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
.nf-close-guard {
  margin-bottom: 12px;
}
.nf-reject-tip {
  margin: 0 0 10px;
  font-size: 13px;
  line-height: 1.55;
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
.nf-remark-log {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  overflow: hidden;
}
.nf-remark-item {
  padding: 10px 12px 10px 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: #fafafa;
}
.nf-remark-item:last-child {
  border-bottom: none;
}
.nf-remark-item--done {
  background: #f9fafb;
  border-left: 4px solid #10b981;
  padding-left: 10px;
}
.nf-remark-item--high {
  color: #b91c1c;
  background: #fef2f2;
  border-left: 4px solid #dc2626;
  padding-left: 10px;
}
.nf-remark-item--done .nf-remark-text {
  color: #6b7280;
  text-decoration: line-through;
}
.nf-remark-item--high .nf-remark-meta {
  color: #991b1b;
}
.nf-remark-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 6px;
}
.nf-remark-text {
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
