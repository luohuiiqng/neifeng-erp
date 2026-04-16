<template>
  <div class="nf-page">
    <el-card shadow="never">
      <template #header>
        <div class="nf-toolbar">
          <div>
            <span class="nf-title">仓库库存台账</span>
            <p class="nf-sub">浙江润丰机械：默认预置 300 条物料（原材料/半成品/零部件），采购到货登记后自动入库，支持手工出库与盘点调整。</p>
          </div>
          <div class="nf-toolbar__right">
            <el-input v-model="kw" clearable placeholder="筛选编码/名称/规格" style="width: 260px" />
            <el-select v-model="categoryFilter" clearable placeholder="分类" style="width: 140px">
              <el-option label="全部" value="" />
              <el-option label="原材料" value="原材料" />
              <el-option label="半成品" value="半成品" />
              <el-option label="零部件" value="零部件" />
            </el-select>
            <el-button type="primary" @click="openIssue">手工出库</el-button>
            <el-button @click="openAdjust">库存调整</el-button>
          </div>
        </div>
      </template>

      <div class="nf-kpis">
        <el-tag type="info" effect="plain">物料数：{{ rows.length }}</el-tag>
        <el-tag type="info" effect="plain">原材料：{{ categoryCounts.raw }}</el-tag>
        <el-tag type="info" effect="plain">半成品：{{ categoryCounts.semi }}</el-tag>
        <el-tag type="info" effect="plain">零部件：{{ categoryCounts.part }}</el-tag>
        <el-tag :type="lowStockRows.length ? 'danger' : 'success'" effect="plain">低于安全库存：{{ lowStockRows.length }}</el-tag>
        <el-tag type="warning" effect="plain">在途（采购未到货）：{{ inTransitTotal }}</el-tag>
      </div>

      <el-table :data="rows" stripe border class="nf-mt">
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

      <h4 class="nf-h4">库存流水</h4>
      <el-table :data="txRows" stripe>
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
    </el-card>

    <el-dialog v-model="issueVisible" title="手工出库" width="500px" destroy-on-close>
      <el-form :model="issueForm" label-width="90px">
        <el-form-item label="物料">
          <el-select v-model="issueForm.materialCode" filterable style="width: 100%">
            <el-option
              v-for="m in rows"
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
              v-for="m in rows"
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
import { computed, reactive, ref } from 'vue'
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

const rows = computed(() => {
  const k = kw.value.trim().toLowerCase()
  return data.value.materials
    .map((m) => ({
      ...m,
      inTransitQty: inTransitByMaterial.value.get(m.code) || 0,
    }))
    .filter((m) => {
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

const lowStockRows = computed(() => rows.value.filter((m) => (Number(m.stockQty) || 0) < (Number(m.safetyQty) || 0)))
const inTransitTotal = computed(() => rows.value.reduce((s, r) => s + (Number(r.inTransitQty) || 0), 0))
const categoryCounts = computed(() => ({
  raw: rows.value.filter((r) => r.category === '原材料').length,
  semi: rows.value.filter((r) => r.category === '半成品').length,
  part: rows.value.filter((r) => r.category === '零部件').length,
}))
const txRows = computed(() =>
  data.value.transactions.slice(0, 200).map((t) => ({
    ...t,
    materialName: warehouseStore.materialByCode(t.materialCode)?.name || '—',
  })),
)

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

function openIssue() {
  issueForm.materialCode = rows.value[0]?.code || ''
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
  const m = rows.value[0]
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
</style>
