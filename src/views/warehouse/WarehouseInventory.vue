<template>
  <div class="nf-page">
    <el-card shadow="never">
      <template #header>
        <div class="nf-toolbar">
          <div>
            <span class="nf-title">仓库</span>
            <p class="nf-sub">
              库存台账支持筛选与分页；流水在「库存流水」页签中查看。可新增原材料/半成品/成品，采购到货自动入库，支持手工出库与盘点调整。
            </p>
          </div>
          <div class="nf-toolbar__right">
            <el-input v-model="kw" clearable placeholder="筛选编码/名称/规格" style="width: 260px" />
            <el-select v-model="categoryFilter" clearable placeholder="分类" style="width: 140px">
              <el-option label="全部" value="" />
              <el-option label="原材料" value="原材料" />
              <el-option label="半成品" value="半成品" />
              <el-option label="零部件" value="零部件" />
              <el-option label="成品" value="成品" />
            </el-select>
            <el-button type="success" @click="openAdd">新增物料</el-button>
            <el-button type="primary" @click="openIssue">手工出库</el-button>
            <el-button @click="openAdjust">库存调整</el-button>
          </div>
        </div>
      </template>

      <div class="nf-kpis">
        <el-tag type="info" effect="plain">台账筛选结果：{{ filteredRows.length }} 条</el-tag>
        <el-tag type="info" effect="plain">原材料：{{ categoryCounts.raw }}</el-tag>
        <el-tag type="info" effect="plain">半成品：{{ categoryCounts.semi }}</el-tag>
        <el-tag type="info" effect="plain">零部件：{{ categoryCounts.part }}</el-tag>
        <el-tag type="info" effect="plain">成品：{{ categoryCounts.product }}</el-tag>
        <el-tag :type="lowStockRows.length ? 'danger' : 'success'" effect="plain">低于安全库存：{{ lowStockRows.length }}</el-tag>
        <el-tag type="warning" effect="plain">在途（采购未到货）：{{ inTransitTotal }}</el-tag>
      </div>

      <el-tabs v-model="mainTab" class="nf-warehouse-tabs nf-mt">
        <el-tab-pane label="库存台账" name="ledger">
          <div class="nf-tab-toolbar">
            <el-button @click="exportLedgerCsv">导出 CSV（当前筛选全部）</el-button>
          </div>
          <el-table :data="pagedLedgerRows" stripe border>
            <el-table-column prop="code" label="物料编码" width="120" />
            <el-table-column prop="name" label="名称" min-width="140" />
            <el-table-column prop="category" label="分类" width="90" />
            <el-table-column prop="spec" label="规格" width="120" />
            <el-table-column prop="unit" label="单位" width="72" />
            <el-table-column prop="location" label="库位" width="100" />
            <el-table-column prop="stockQty" label="库存" width="90" align="right" />
            <el-table-column prop="safetyQty" label="安全库存" width="100" align="right" />
            <el-table-column prop="inTransitQty" label="在途" width="90" align="right" />
            <el-table-column label="库存状态" width="110">
              <template #default="{ row }">
                <el-tag :type="row.stockQty < row.safetyQty ? 'danger' : 'success'" size="small">
                  {{ row.stockQty < row.safetyQty ? '需补货' : '正常' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
          <div class="nf-pagination">
            <el-pagination
              v-model:current-page="ledgerPage"
              v-model:page-size="ledgerPageSize"
              :page-sizes="[10, 20, 50, 100]"
              :total="filteredRows.length"
              layout="total, sizes, prev, pager, next, jumper"
              background
            />
          </div>
        </el-tab-pane>
        <el-tab-pane label="库存流水" name="tx">
          <p class="nf-tab-hint">
            按时间倒序（本地数据）。可按<strong>业务日期</strong>、<strong>类型</strong>、<strong>物料编码/名称</strong>筛选；导出为当前筛选下的<strong>全部</strong>流水（不限当前页）。
          </p>
          <div class="nf-tab-toolbar nf-tab-toolbar--wrap">
            <el-date-picker
              v-model="txDateRange"
              type="daterange"
              unlink-panels
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              clearable
              style="width: 280px"
            />
            <el-select v-model="txTypeFilter" clearable placeholder="流水类型" style="width: 150px">
              <el-option label="全部类型" value="" />
              <el-option v-for="opt in txTypeOptions" :key="opt" :label="opt" :value="opt" />
            </el-select>
            <el-input v-model="txMaterialKw" clearable placeholder="物料编码或名称" style="width: 220px" />
            <el-button @click="exportTxCsv">导出 CSV（当前筛选全部）</el-button>
          </div>
          <el-table :data="pagedTxRows" stripe border>
            <el-table-column prop="date" label="日期" width="110" />
            <el-table-column prop="type" label="类型" width="92" />
            <el-table-column prop="materialCode" label="物料编码" width="120" />
            <el-table-column prop="materialName" label="物料" min-width="120" />
            <el-table-column prop="qty" label="数量" width="90" align="right" />
            <el-table-column prop="refType" label="来源" width="100" />
            <el-table-column prop="refId" label="来源单号" width="160" />
            <el-table-column prop="operator" label="操作人" width="100" />
            <el-table-column prop="note" label="备注" min-width="120" />
          </el-table>
          <div class="nf-pagination">
            <el-pagination
              v-model:current-page="txPage"
              v-model:page-size="txPageSize"
              :page-sizes="[10, 20, 50, 100]"
              :total="filteredTxRows.length"
              layout="total, sizes, prev, pager, next, jumper"
              background
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="addVisible" title="新增物料" width="520px" destroy-on-close @closed="resetAddForm">
      <el-form :model="addForm" label-width="100px" :rules="addRules" ref="addFormRef">
        <el-form-item label="分类" prop="category">
          <el-radio-group v-model="addForm.category">
            <el-radio-button label="原材料" />
            <el-radio-button label="半成品" />
            <el-radio-button label="成品" />
          </el-radio-group>
        </el-form-item>
        <el-form-item label="名称" prop="name">
          <el-input v-model="addForm.name" maxlength="80" show-word-limit placeholder="物料名称" />
        </el-form-item>
        <el-form-item label="规格" prop="spec">
          <el-input v-model="addForm.spec" maxlength="120" show-word-limit placeholder="可填型号、尺寸等，无则留空" />
        </el-form-item>
        <el-form-item label="单位" prop="unit">
          <el-input v-model="addForm.unit" maxlength="16" placeholder="如：件、台、张、米" style="max-width: 200px" />
        </el-form-item>
        <el-form-item label="库位" prop="location">
          <el-input v-model="addForm.location" maxlength="40" placeholder="默认按分类生成，可改" />
        </el-form-item>
        <el-form-item label="安全库存" prop="safetyQty">
          <el-input-number v-model="addForm.safetyQty" :min="0" :max="999999" />
        </el-form-item>
        <el-form-item label="期初库存" prop="stockQty">
          <el-input-number v-model="addForm.stockQty" :min="0" :max="999999" />
          <span class="nf-muted-inline">大于 0 时记入一条「手工建档」入库流水</span>
        </el-form-item>
        <el-form-item label="备注" prop="note">
          <el-input v-model="addForm.note" type="textarea" :rows="2" maxlength="200" show-word-limit placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addVisible = false">取消</el-button>
        <el-button type="primary" @click="onAddSubmit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="issueVisible" title="手工出库" width="500px" destroy-on-close>
      <el-form :model="issueForm" label-width="90px">
        <el-form-item label="物料">
          <el-select v-model="issueForm.materialCode" filterable style="width: 100%">
            <el-option
              v-for="m in allMaterialRows"
              :key="m.code"
              :label="`${m.code} · ${m.name}（库存${m.stockQty}${m.unit}）`"
              :value="m.code"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="数量">
          <el-input-number v-model="issueForm.qty" :min="1" :max="99999" />
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker v-model="issueForm.date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="用途">
          <el-input v-model="issueForm.note" placeholder="例如：MO-2026-xxxx 生产领料" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="issueVisible = false">取消</el-button>
        <el-button type="primary" @click="onIssue">确认出库</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="adjustVisible" title="库存调整" width="500px" destroy-on-close>
      <el-form :model="adjustForm" label-width="90px">
        <el-form-item label="物料">
          <el-select v-model="adjustForm.materialCode" filterable style="width: 100%">
            <el-option
              v-for="m in allMaterialRows"
              :key="m.code"
              :label="`${m.code} · ${m.name}（当前${m.stockQty}${m.unit}）`"
              :value="m.code"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="新库存">
          <el-input-number v-model="adjustForm.newQty" :min="0" :max="999999" />
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker v-model="adjustForm.date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="adjustForm.note" placeholder="盘点差异原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustVisible = false">取消</el-button>
        <el-button type="primary" @click="onAdjust">确认调整</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { useWarehouseStore } from '@/stores/warehouse'
import { usePurchaseOrderStore } from '@/stores/purchaseOrders'
import { useRolesStore } from '@/stores/roles'

const warehouseStore = useWarehouseStore()
const purchaseStore = usePurchaseOrderStore()
const rolesStore = useRolesStore()
const { data } = storeToRefs(warehouseStore)
const { orders: purchaseOrders } = storeToRefs(purchaseStore)

const kw = ref('')
const categoryFilter = ref('')
const mainTab = ref('ledger')
const ledgerPage = ref(1)
const ledgerPageSize = ref(20)
const txPage = ref(1)
const txPageSize = ref(20)
const txTypeFilter = ref('')
const txMaterialKw = ref('')
/** 业务日期区间 [开始, 结束]，与流水字段 date（YYYY-MM-DD）比较 */
const txDateRange = ref(null)

const TX_TYPES_FALLBACK = ['入库', '出库', '盘点调整']

const txTypeOptions = computed(() => {
  const set = new Set(TX_TYPES_FALLBACK)
  for (const t of data.value.transactions) {
    if (t?.type) set.add(String(t.type))
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
})

const inTransitByMaterial = computed(() => {
  const map = new Map()
  for (const po of purchaseOrders.value) {
    for (const l of po.lines || []) {
      const code = String(l?.materialCode || '').trim()
      if (!code) continue
      const pending = Math.max(0, (Number(l?.qty) || 0) - (Number(l?.receivedQty) || 0))
      map.set(code, (map.get(code) || 0) + pending)
    }
  }
  return map
})

const allMaterialRows = computed(() =>
  data.value.materials.map((m) => ({
    ...m,
    inTransitQty: inTransitByMaterial.value.get(m.code) || 0,
  })),
)

const filteredRows = computed(() => {
  const k = kw.value.trim().toLowerCase()
  return allMaterialRows.value.filter((m) => {
    const matchCategory = !categoryFilter.value || m.category === categoryFilter.value
    if (!matchCategory) return false
    if (!k) return true
    return (
      String(m.code).toLowerCase().includes(k) ||
      String(m.name).toLowerCase().includes(k) ||
      String(m.spec).toLowerCase().includes(k)
    )
  })
})

const pagedLedgerRows = computed(() => {
  const start = (ledgerPage.value - 1) * ledgerPageSize.value
  return filteredRows.value.slice(start, start + ledgerPageSize.value)
})

const lowStockRows = computed(() => filteredRows.value.filter((m) => (Number(m.stockQty) || 0) < (Number(m.safetyQty) || 0)))
const inTransitTotal = computed(() => filteredRows.value.reduce((s, r) => s + (Number(r.inTransitQty) || 0), 0))
const categoryCounts = computed(() => ({
  raw: data.value.materials.filter((r) => r.category === '原材料').length,
  semi: data.value.materials.filter((r) => r.category === '半成品').length,
  part: data.value.materials.filter((r) => r.category === '零部件').length,
  product: data.value.materials.filter((r) => r.category === '成品').length,
}))
const txRowsFull = computed(() =>
  data.value.transactions.map((t) => ({
    ...t,
    materialName: warehouseStore.materialByCode(t.materialCode)?.name || '—',
  })),
)

function transactionDateInRange(t) {
  const range = txDateRange.value
  if (!Array.isArray(range) || range.length !== 2 || !range[0] || !range[1]) return true
  const d = String(t?.date || '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false
  return d >= range[0] && d <= range[1]
}

const filteredTxRows = computed(() => {
  const k = txMaterialKw.value.trim().toLowerCase()
  return txRowsFull.value.filter((t) => {
    if (!transactionDateInRange(t)) return false
    if (txTypeFilter.value && String(t.type || '') !== txTypeFilter.value) return false
    if (!k) return true
    const code = String(t.materialCode || '').toLowerCase()
    const name = String(t.materialName || '').toLowerCase()
    return code.includes(k) || name.includes(k)
  })
})

const pagedTxRows = computed(() => {
  const start = (txPage.value - 1) * txPageSize.value
  return filteredTxRows.value.slice(start, start + txPageSize.value)
})

const addVisible = ref(false)
const addFormRef = ref(null)
const addForm = reactive({
  category: '原材料',
  name: '',
  spec: '',
  unit: '件',
  location: '',
  safetyQty: 0,
  stockQty: 0,
  note: '',
})
const addRules = {
  category: [{ required: true, message: '请选择分类', trigger: 'change' }],
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  unit: [{ required: true, message: '请输入单位', trigger: 'blur' }],
}

const issueVisible = ref(false)
const issueForm = reactive({
  materialCode: '',
  qty: 1,
  date: '',
  note: '',
})

const adjustVisible = ref(false)
const adjustForm = reactive({
  materialCode: '',
  newQty: 0,
  date: '',
  note: '',
})

function todayStr() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function csvCell(v) {
  const s = String(v ?? '')
  return `"${s.replace(/"/g, '""')}"`
}

function downloadCsv(filename, lines) {
  const body = `\ufeff${lines.join('\r\n')}`
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportLedgerCsv() {
  const headers = ['物料编码', '名称', '分类', '规格', '单位', '库位', '库存', '安全库存', '在途', '库存状态']
  const lines = [headers.map(csvCell).join(',')]
  for (const m of filteredRows.value) {
    const status = (Number(m.stockQty) || 0) < (Number(m.safetyQty) || 0) ? '需补货' : '正常'
    lines.push(
      [
        csvCell(m.code),
        csvCell(m.name),
        csvCell(m.category),
        csvCell(m.spec),
        csvCell(m.unit),
        csvCell(m.location),
        csvCell(m.stockQty),
        csvCell(m.safetyQty),
        csvCell(m.inTransitQty),
        csvCell(status),
      ].join(','),
    )
  }
  downloadCsv(`仓库台账_${todayStr()}.csv`, lines)
  ElMessage.success(`已导出 ${filteredRows.value.length} 条`)
}

function exportTxCsv() {
  const headers = ['日期', '类型', '物料编码', '物料', '数量', '来源', '来源单号', '操作人', '备注']
  const lines = [headers.map(csvCell).join(',')]
  for (const t of filteredTxRows.value) {
    lines.push(
      [
        csvCell(t.date),
        csvCell(t.type),
        csvCell(t.materialCode),
        csvCell(t.materialName),
        csvCell(t.qty),
        csvCell(t.refType),
        csvCell(t.refId),
        csvCell(t.operator),
        csvCell(t.note),
      ].join(','),
    )
  }
  downloadCsv(`库存流水_${todayStr()}.csv`, lines)
  ElMessage.success(`已导出 ${filteredTxRows.value.length} 条`)
}

function defaultSafetyForCategory(cat) {
  if (cat === '原材料') return 8
  if (cat === '半成品') return 3
  if (cat === '成品') return 2
  return 6
}

function openAdd() {
  addForm.category = '原材料'
  addForm.name = ''
  addForm.spec = ''
  addForm.unit = '件'
  addForm.location = ''
  addForm.safetyQty = defaultSafetyForCategory('原材料')
  addForm.stockQty = 0
  addForm.note = ''
  addVisible.value = true
}

function resetAddForm() {
  addFormRef.value?.resetFields?.()
}

async function onAddSubmit() {
  const form = addFormRef.value
  if (form) {
    try {
      await form.validate()
    } catch {
      return
    }
  } else if (!addForm.name.trim()) {
    ElMessage.warning('请输入物料名称')
    return
  }
  const r = warehouseStore.addMaterial({
    category: addForm.category,
    name: addForm.name.trim(),
    spec: addForm.spec.trim(),
    unit: addForm.unit.trim() || '件',
    location: addForm.location.trim(),
    safetyQty: addForm.safetyQty,
    stockQty: addForm.stockQty,
    note: addForm.note.trim(),
    date: todayStr(),
    operator: rolesStore.currentRole?.name || '仓管',
  })
  if (!r.ok) {
    ElMessage.warning(r.message || '保存失败')
    return
  }
  addVisible.value = false
  ElMessage.success(`已新增物料 ${r.code}`)
  mainTab.value = 'ledger'
  ledgerPage.value = 1
}

watch(
  () => addForm.category,
  (cat) => {
    if (!addVisible.value) return
    addForm.safetyQty = defaultSafetyForCategory(cat)
  },
)

watch([kw, categoryFilter], () => {
  ledgerPage.value = 1
})

watch(txPageSize, () => {
  txPage.value = 1
})

watch(ledgerPageSize, () => {
  ledgerPage.value = 1
})

watch([() => filteredRows.value.length, ledgerPageSize], () => {
  const max = Math.max(1, Math.ceil(filteredRows.value.length / ledgerPageSize.value) || 1)
  if (ledgerPage.value > max) ledgerPage.value = max
})

watch([() => filteredTxRows.value.length, txPageSize], () => {
  const max = Math.max(1, Math.ceil(filteredTxRows.value.length / txPageSize.value) || 1)
  if (txPage.value > max) txPage.value = max
})

watch([txTypeFilter, txMaterialKw, txDateRange], () => {
  txPage.value = 1
})

function openIssue() {
  issueForm.materialCode = filteredRows.value[0]?.code || allMaterialRows.value[0]?.code || ''
  issueForm.qty = 1
  issueForm.date = todayStr()
  issueForm.note = ''
  issueVisible.value = true
}

function onIssue() {
  if (!issueForm.materialCode) {
    ElMessage.warning('请选择物料')
    return
  }
  const r = warehouseStore.issueOutbound({
    materialCode: issueForm.materialCode,
    qty: issueForm.qty,
    date: issueForm.date || todayStr(),
    operator: rolesStore.currentRole?.name || '仓管',
    note: issueForm.note,
  })
  if (!r.ok) {
    ElMessage.warning(r.message || '出库失败')
    return
  }
  issueVisible.value = false
  ElMessage.success('已出库')
}

function openAdjust() {
  const m = filteredRows.value[0] || allMaterialRows.value[0]
  adjustForm.materialCode = m?.code || ''
  adjustForm.newQty = Number(m?.stockQty) || 0
  adjustForm.date = todayStr()
  adjustForm.note = ''
  adjustVisible.value = true
}

function onAdjust() {
  if (!adjustForm.materialCode) {
    ElMessage.warning('请选择物料')
    return
  }
  const r = warehouseStore.adjustStock({
    materialCode: adjustForm.materialCode,
    newQty: adjustForm.newQty,
    date: adjustForm.date || todayStr(),
    operator: rolesStore.currentRole?.name || '仓管',
    note: adjustForm.note,
  })
  if (!r.ok) {
    ElMessage.warning(r.message || '调整失败')
    return
  }
  adjustVisible.value = false
  ElMessage.success('库存已调整')
}
</script>

<style scoped>
.nf-page {
  max-width: 1200px;
  margin: 0 auto;
}
.nf-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.nf-title {
  font-weight: 600;
  font-size: 16px;
}
.nf-sub {
  margin: 6px 0 0;
  font-size: 12px;
  color: #6b7280;
}
.nf-toolbar__right {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.nf-kpis {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.nf-mt {
  margin-top: 12px;
}
.nf-h4 {
  margin: 18px 0 10px;
  font-size: 15px;
}
.nf-muted-inline {
  margin-left: 10px;
  font-size: 12px;
  color: #6b7280;
}
.nf-warehouse-tabs :deep(.el-tabs__header) {
  margin-bottom: 12px;
}
.nf-tab-hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
}
.nf-tab-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-bottom: 10px;
}
.nf-tab-toolbar--wrap {
  justify-content: flex-start;
  flex-wrap: wrap;
}
.nf-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
  padding-bottom: 4px;
}
</style>
