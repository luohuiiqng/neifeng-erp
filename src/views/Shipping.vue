<template>
  <div class="nf-page">
    <el-card shadow="never">
      <template #header>
        <div class="nf-ship-head">
          <span class="nf-head">出货确认</span>
          <span class="nf-ship-hint">
            <strong>出货提交</strong>由具备「操作·出货确认提交」的<strong>车间主任</strong>（或管理员）操作；须生产订单处于
            {{ wfStore.shipReadyStatusesLabel }} 且<strong>厂长已同意出货</strong>后方可提交。其他角色可查看但无提交按钮。
          </span>
        </div>
      </template>
      <el-form :model="form" label-width="120px" class="nf-form">
        <el-form-item label="关联生产订单">
          <el-select v-model="form.orderId" filterable placeholder="选择生产订单" style="width: 100%; max-width: 560px">
            <el-option
              v-for="o in orders"
              :key="o.id"
              :label="`${o.id} · ${o.customer} · ${o.status} · 已出${Number(o.shippedQty) || 0}/${Number(o.totalQty) || 0}`"
              :value="o.id"
            />
          </el-select>
        </el-form-item>
      </el-form>

      <template v-if="selectedOrder">
        <el-descriptions :column="3" border class="nf-block">
          <el-descriptions-item label="生产单号">{{ selectedOrder.id }}</el-descriptions-item>
          <el-descriptions-item label="客户">{{ selectedOrder.customer }}</el-descriptions-item>
          <el-descriptions-item label="交付日期">{{ selectedOrder.dueDate || '—' }}</el-descriptions-item>
          <el-descriptions-item label="当前状态">
            <el-tag :type="wfStore.tagTypeFor(selectedOrder.status)">{{ selectedOrder.status }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="出货审批">
            <el-tag :type="shipReleaseReady ? 'success' : 'warning'">
              {{ shipReleaseReady ? '已同意出货' : '待同意出货' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="分批策略">
            <el-tag :type="selectedOrder.allowPartialShip ? 'info' : 'danger'">
              {{ selectedOrder.allowPartialShip ? '允许分批出货' : '仅允许整单出货' }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <div class="nf-kpis">
          <el-tag type="info" effect="plain">
            {{ selectedOrder.allowPartialShip ? '出货目标台数' : '订单总台数' }}：{{ orderTotalForShip }}
          </el-tag>
          <el-tag
            :type="shippedQty >= orderTotalForShip && orderTotalForShip > 0 ? 'success' : 'warning'"
            effect="plain"
          >
            已出货：{{ shippedQty }}
          </el-tag>
          <el-tag type="danger" effect="plain">待出货：{{ remainingQty }}</el-tag>
          <el-tag type="primary" effect="plain">出货进度：{{ shipProgress }}%</el-tag>
        </div>

        <div class="nf-checklist">
          <div class="nf-checklist__item" v-for="item in submitChecks" :key="item.label">
            <el-tag :type="item.ok ? 'success' : 'danger'" size="small">{{ item.ok ? '通过' : '未通过' }}</el-tag>
            <span>{{ item.label }}</span>
          </div>
        </div>

        <el-alert
          v-if="selectedOrder.pendingShipmentPlan?.batchQty"
          type="success"
          show-icon
          :closable="false"
          class="nf-block nf-ship-plan-alert"
          title="已载入「提交出货审批」中的本批计划：须按下列明细原样出货（合计与各行须与审批一致）。"
        />
        <h4 class="nf-h4">订单明细（本次按明细出货）</h4>
        <el-table :data="selectedOrder.lines || []" stripe border class="nf-ship-line-table">
          <el-table-column type="index" width="50" />
          <el-table-column prop="unit" label="单位名称" width="120" />
          <el-table-column prop="model" label="机型" min-width="160" />
          <el-table-column prop="temp" label="冷/热" width="80" />
          <el-table-column prop="stitch" label="缝包" width="82" />
          <el-table-column prop="qty" label="合同" width="72" align="center" />
          <el-table-column label="明细已出" width="82" align="center">
            <template #default="{ row }">{{ row.shippedQty ?? 0 }}</template>
          </el-table-column>
          <el-table-column label="明细待出" width="82" align="center">
            <template #default="{ row }">{{ lineRemainingForShip(row) }}</template>
          </el-table-column>
          <el-table-column label="本次出货" min-width="128" align="center">
            <template #default="{ row }">
              <el-input-number
                :model-value="lineShipDraft[row.lineId] ?? 0"
                :min="0"
                :max="lineRemainingForShip(row)"
                size="small"
                controls-position="right"
                @update:model-value="(v) => (lineShipDraft[row.lineId] = v)"
              />
            </template>
          </el-table-column>
          <el-table-column prop="punch" label="打孔" width="82" />
          <el-table-column prop="note" label="备注" min-width="120" show-overflow-tooltip />
        </el-table>

        <div class="nf-h4-row">
          <h4 class="nf-h4">历史出货记录</h4>
          <div class="nf-print-tools">
            <el-select v-model="printShipmentId" placeholder="选择批次打印" style="width: 260px" :disabled="!shipmentRows.length">
              <el-option v-for="s in shipmentRows" :key="s.id" :label="`${s.id} · ${s.date} · ${s.qty}台`" :value="s.id" />
            </el-select>
            <el-button :disabled="!printTargetShipment" @click="onPrintShipment">打印当前批次</el-button>
          </div>
        </div>
        <el-table v-if="shipmentRows.length" :data="shipmentRows" stripe border>
          <el-table-column prop="id" label="批次号" width="190" />
          <el-table-column prop="date" label="出货日期" width="120" />
          <el-table-column prop="qty" label="出货台数" width="90" />
          <el-table-column label="明细分摊" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ formatShipmentLineAlloc(row) }}</template>
          </el-table-column>
          <el-table-column prop="manager" label="发货负责人" width="120" />
          <el-table-column prop="tracking" label="物流单号" min-width="140" />
          <el-table-column prop="note" label="备注" min-width="180" show-overflow-tooltip />
        </el-table>
        <el-empty v-else description="暂无历史出货记录" />
      </template>

      <h4 class="nf-h4">本次出货登记</h4>
      <el-form :model="form" label-width="120px" class="nf-form">
        <el-form-item v-if="selectedOrder?.allowPartialShip" label="出货目标台数">
          <el-input-number v-model="shippableTotalDraft" :min="minShippableTotal" :max="99999" />
          <span class="nf-muted">须 ≥ 已出货（{{ shippedQty }}）；明细台数合计 {{ lineQtySum }} 台</span>
        </el-form-item>
        <el-form-item label="出货日期">
          <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
        </el-form-item>
        <el-form-item label="发货负责人">
          <el-input v-model="form.manager" placeholder="如：车间主任" style="max-width: 320px" />
        </el-form-item>
        <el-form-item label="本批合计">
          <span class="nf-batch-sum">{{ batchLineShipQty }} 台</span>
          <span class="nf-muted">（由各明细「本次出货」合计；订单待出 {{ remainingQty }} 台）</span>
        </el-form-item>
        <el-form-item label="物流单号">
          <el-input v-model="form.tracking" placeholder="建议填写，便于售后追踪" style="max-width: 400px" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.note" type="textarea" rows="3" placeholder="签收约定、木箱编号等" style="max-width: 560px" />
        </el-form-item>
        <el-form-item>
          <el-tooltip
            :disabled="rolesStore.can('action_ship_submit')"
            :content="permissionTip('action_ship_submit')"
            placement="top"
          >
            <span>
              <el-button type="primary" :disabled="!rolesStore.can('action_ship_submit') || !canSubmitByBiz" @click="onSubmit">
                确认出货
              </el-button>
            </span>
          </el-tooltip>
          <el-button @click="onReset">重置</el-button>
          <span v-if="!rolesStore.can('action_ship_submit')" class="nf-no-perm">{{ permissionTip('action_ship_submit') }}</span>
          <span v-else-if="!canSubmitByBiz" class="nf-no-perm">{{ submitBlockReason }}</span>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, onMounted, computed, watch, ref } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { useProductionOrderStore } from '@/stores/productionOrders'
import { useRolesStore } from '@/stores/roles'
import { useOrderWorkflowStore } from '@/stores/orderWorkflow'
import { permissionTip } from '@/utils/permissionMeta'

const route = useRoute()
const rolesStore = useRolesStore()
const poStore = useProductionOrderStore()
const wfStore = useOrderWorkflowStore()
const { orders } = storeToRefs(poStore)

const form = reactive({
  orderId: '',
  date: '',
  manager: '车间主任',
  tracking: '',
  note: '',
})
const lineShipDraft = reactive({})

const selectedOrder = computed(() => orders.value.find((o) => o.id === form.orderId))
const lineQtySum = computed(() => {
  const o = selectedOrder.value
  if (!o || !Array.isArray(o.lines)) return 0
  return o.lines.reduce((s, l) => s + (Number(l.qty) || 0), 0)
})
const shippableTotalDraft = ref(1)
const shippedQty = computed(() => Math.max(0, Number(selectedOrder.value?.shippedQty) || 0))
const minShippableTotal = computed(() => Math.max(1, shippedQty.value))
const orderTotalForShip = computed(() => {
  const o = selectedOrder.value
  if (!o) return 0
  if (o.allowPartialShip) {
    const n = Math.floor(Number(shippableTotalDraft.value))
    if (Number.isFinite(n) && n > 0) return n
  }
  return Math.max(0, Number(o.totalQty) || 0)
})
const remainingQty = computed(() => Math.max(0, orderTotalForShip.value - shippedQty.value))
const shipReleaseReady = computed(() => {
  const o = selectedOrder.value
  if (!o) return false
  return !!o.shipReleaseApproved || wfStore.isShippableStatusCode(o.status)
})
const shipProgress = computed(() => {
  if (!orderTotalForShip.value) return 0
  return Math.min(100, Math.round((shippedQty.value / orderTotalForShip.value) * 100))
})
const batchLineShipQty = computed(() => {
  const o = selectedOrder.value
  if (!o?.lines) return 0
  return o.lines.reduce((s, l) => s + Math.max(0, Math.floor(Number(lineShipDraft[l.lineId]) || 0)), 0)
})
function lineRemainingForShip(row) {
  const q = Math.max(0, Number(row?.qty) || 0)
  const sh = Math.max(0, Number(row?.shippedQty) || 0)
  return Math.max(0, q - sh)
}
const lineShipDraftValid = computed(() => {
  const o = selectedOrder.value
  if (!o?.lines?.length) return false
  for (const l of o.lines) {
    const q = Math.max(0, Math.floor(Number(lineShipDraft[l.lineId]) || 0))
    if (q > lineRemainingForShip(l)) return false
  }
  if (batchLineShipQty.value < 1 || batchLineShipQty.value > remainingQty.value) return false
  return true
})
const shipmentRows = computed(() => (Array.isArray(selectedOrder.value?.shipments) ? selectedOrder.value.shipments : []))
const printShipmentId = ref('')
const printTargetShipment = computed(() => shipmentRows.value.find((x) => x.id === printShipmentId.value) || shipmentRows.value[0] || null)
const submitChecks = computed(() => [
  { label: `订单状态需为 ${wfStore.shipReadyStatusesLabel}`, ok: !!selectedOrder.value && wfStore.isShippableStatusCode(selectedOrder.value.status) },
  { label: '订单含明细（按明细拆分出货）', ok: !!(selectedOrder.value?.lines?.length) },
  { label: '厂长已同意出货', ok: shipReleaseReady.value },
  { label: '存在待出货数量', ok: remainingQty.value > 0 },
  { label: '各明细本次出货合法且合计有效', ok: lineShipDraftValid.value },
  {
    label: selectedOrder.value?.allowPartialShip ? '允许分批出货' : '仅允许整单出货（本次需提交全部剩余数量）',
    ok: !selectedOrder.value || selectedOrder.value.allowPartialShip || batchLineShipQty.value === remainingQty.value,
  },
])
const canSubmitByBiz = computed(() => submitChecks.value.every((x) => x.ok))
const submitBlockReason = computed(() => submitChecks.value.find((x) => !x.ok)?.label || '')

onMounted(() => {
  form.date = new Date().toISOString().slice(0, 10)
  const q = route.query.order
  if (q) form.orderId = q
  else if (orders.value[1]) form.orderId = orders.value[1].id
})
function initLineShipDraftForOrder() {
  const o = selectedOrder.value
  Object.keys(lineShipDraft).forEach((k) => delete lineShipDraft[k])
  if (!o?.id) return
  poStore.touchLineStructure(o.id)
  const lines = o.lines || []
  const plan = o.pendingShipmentPlan
  const remHeader = Math.max(0, orderTotalForShip.value - shippedQty.value)
  for (const line of lines) {
    const id = line.lineId
    if (plan?.lineAllocations?.length) {
      const hit = plan.lineAllocations.find((a) => a.lineId === id)
      lineShipDraft[id] = hit ? hit.qty : 0
    } else if (!o.allowPartialShip) {
      lineShipDraft[id] = lineRemainingForShip(line)
    } else if (lines.length === 1) {
      lineShipDraft[id] = Math.min(lineRemainingForShip(line), remHeader)
    } else {
      lineShipDraft[id] = 0
    }
  }
}

watch(
  () => selectedOrder.value?.id,
  () => {
    const o = selectedOrder.value
    if (o?.allowPartialShip) {
      const header = Math.max(0, Number(o.totalQty) || 0)
      const shipped = Math.max(0, Number(o.shippedQty) || 0)
      const lineSum = (o.lines || []).reduce((s, l) => s + (Number(l.qty) || 0), 0)
      shippableTotalDraft.value = Math.max(header, lineSum, shipped, 1)
    }
    initLineShipDraftForOrder()
    printShipmentId.value = shipmentRows.value[0]?.id || ''
  },
  { immediate: true },
)

function onSubmit() {
  if (!rolesStore.can('action_ship_submit')) {
    ElMessage.warning(permissionTip('action_ship_submit'))
    return
  }
  if (!selectedOrder.value) {
    ElMessage.warning('请选择关联生产订单')
    return
  }
  if (!canSubmitByBiz.value) {
    ElMessage.warning(submitBlockReason.value || '当前订单不满足出货条件')
    return
  }
  if (selectedOrder.value.allowPartialShip) {
    const sync = poStore.setShippableTotalQty(form.orderId, shippableTotalDraft.value)
    if (!sync?.ok) {
      ElMessage.warning(sync?.message || '出货目标台数无效')
      return
    }
  }
  const o = selectedOrder.value
  const lineAllocations = (o.lines || [])
    .map((l) => ({
      lineId: l.lineId,
      qty: Math.max(0, Math.floor(Number(lineShipDraft[l.lineId]) || 0)),
    }))
    .filter((x) => x.qty > 0)
  const r = poStore.recordShipment(form.orderId, {
    qty: batchLineShipQty.value,
    lineAllocations,
    date: form.date,
    manager: form.manager,
    tracking: form.tracking,
    note: form.note,
  })
  if (!r?.ok) {
    ElMessage.warning(r?.message || '提交失败')
    return
  }
  ElMessage.success(`已提交出货 ${r.qty} 台`)
  printShipmentId.value = r.shipmentId || shipmentRows.value[0]?.id || ''
  form.tracking = ''
  form.note = ''
  initLineShipDraftForOrder()
}

function onReset() {
  form.tracking = ''
  form.note = ''
  initLineShipDraftForOrder()
}

function formatShipmentLineAlloc(row) {
  const o = selectedOrder.value
  const alloc = row?.lineAllocations
  if (!Array.isArray(alloc) || !alloc.length) return '—'
  const lines = o?.lines || []
  return alloc
    .map((a) => {
      const line = lines.find((l) => l.lineId === a.lineId)
      const label = line ? `${line.unit || ''}·${line.model || ''}`.trim() || a.lineId : a.lineId
      return `${label} ${a.qty}台`
    })
    .join('；')
}

function escapeHtml(v) {
  return String(v || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function onPrintShipment() {
  if (!selectedOrder.value || !printTargetShipment.value) {
    ElMessage.warning('请选择可打印的出货批次')
    return
  }
  const o = selectedOrder.value
  const s = printTargetShipment.value
  const allocRows = (Array.isArray(s.lineAllocations) ? s.lineAllocations : [])
    .map((a) => {
      const line = (o.lines || []).find((l) => l.lineId === a.lineId)
      const label = line ? `${line.unit || ''} ${line.model || ''}`.trim() : a.lineId
      return `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(a.qty)}</td></tr>`
    })
    .join('')
  const lines = (o.lines || [])
    .map(
      (x, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(x.unit)}</td>
        <td>${escapeHtml(x.model)}</td>
        <td>${escapeHtml(x.qty)}</td>
        <td>${escapeHtml(x.note || '—')}</td>
      </tr>`,
    )
    .join('')
  const html = `<!doctype html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>出货单 ${escapeHtml(s.id)}</title>
    <style>
      body{font-family:"Microsoft YaHei",sans-serif;color:#111;padding:18px}
      h2{margin:0 0 10px}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;margin-bottom:12px;font-size:13px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th,td{border:1px solid #d1d5db;padding:6px 8px;text-align:left;vertical-align:top}
      th{background:#f8fafc}
      .sign{margin-top:24px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px;font-size:13px}
      .line{margin-top:36px;border-top:1px solid #333;padding-top:4px}
      @media print { body{padding:0} }
    </style>
  </head>
  <body>
    <h2>出货单</h2>
    <div class="meta">
      <div>批次号：${escapeHtml(s.id)}</div>
      <div>生产单号：${escapeHtml(o.id)}</div>
      <div>客户：${escapeHtml(o.customer)}</div>
      <div>出货日期：${escapeHtml(s.date)}</div>
      <div>发货负责人：${escapeHtml(s.manager)}</div>
      <div>本批次台数：${escapeHtml(s.qty)}</div>
      <div>物流单号：${escapeHtml(s.tracking || '—')}</div>
      <div>备注：${escapeHtml(s.note || '—')}</div>
    </div>
    <h3 style="font-size:14px;margin:14px 0 6px">本批明细分摊</h3>
    <table>
      <thead><tr><th>明细（单位·机型）</th><th>本批台数</th></tr></thead>
      <tbody>${allocRows || '<tr><td colspan="2">未记录按明细分摊（历史数据）</td></tr>'}</tbody>
    </table>
    <h3 style="font-size:14px;margin:14px 0 6px">订单合同明细</h3>
    <table>
      <thead><tr><th>#</th><th>单位名称</th><th>机型</th><th>台数</th><th>备注</th></tr></thead>
      <tbody>${lines || '<tr><td colspan="5">无明细</td></tr>'}</tbody>
    </table>
    <div class="sign">
      <div><div class="line">仓库发货</div></div>
      <div><div class="line">物流承运</div></div>
      <div><div class="line">客户签收</div></div>
    </div>
  </body>
  </html>`
  const w = window.open('', '_blank', 'width=980,height=780')
  if (!w) {
    ElMessage.warning('打印窗口被浏览器拦截，请允许弹窗后重试')
    return
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 120)
}
</script>

<style scoped>
.nf-page {
  max-width: 1200px;
  margin: 0 auto;
}
.nf-ship-head {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.nf-head {
  font-weight: 600;
}
.nf-ship-hint {
  font-size: 13px;
  font-weight: normal;
  color: #6b7280;
  line-height: 1.5;
}
.nf-form {
  max-width: 760px;
}
.nf-no-perm {
  margin-left: 12px;
  font-size: 13px;
  color: #9ca3af;
}
.nf-h4 {
  margin: 18px 0 10px;
  font-size: 14px;
  font-weight: 600;
}
.nf-h4-row {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.nf-h4-row .nf-h4 {
  margin: 0;
}
.nf-print-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}
.nf-block {
  margin-top: 8px;
}
.nf-ship-plan-alert {
  margin-top: 12px;
}
.nf-batch-sum {
  font-weight: 600;
  font-size: 16px;
}
.nf-ship-line-table :deep(.el-input-number) {
  width: 110px;
}
.nf-kpis {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.nf-checklist {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px dashed #d1d5db;
  display: grid;
  gap: 8px;
}
.nf-checklist__item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #334155;
}
.nf-muted {
  margin-left: 10px;
  font-size: 12px;
  color: #6b7280;
}
</style>
