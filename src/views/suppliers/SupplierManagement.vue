<template>
  <div class="nf-page">
    <el-card shadow="never">
      <template #header>
        <div class="nf-toolbar">
          <div>
            <span class="nf-title">供应商管理</span>
            <p class="nf-sub">维护供应商档案（联系人、账期、交期等），供采购申请/采购订单引用。</p>
          </div>
          <el-button type="primary" @click="openEdit()">新建供应商</el-button>
        </div>
      </template>

      <el-table :data="rows" stripe>
        <el-table-column prop="id" label="编码" width="110" />
        <el-table-column prop="name" label="供应商" min-width="140" />
        <el-table-column prop="contact" label="联系人" width="100" />
        <el-table-column prop="phone" label="电话" width="130" />
        <el-table-column prop="category" label="类别" width="110" />
        <el-table-column prop="leadDays" label="交期(天)" width="90" align="right" />
        <el-table-column prop="poCount" label="采购单数" width="90" align="right" />
        <el-table-column prop="lineCount" label="交付行数" width="90" align="right" />
        <el-table-column label="逾期率" width="90" align="right">
          <template #default="{ row }">
            <span :class="{ 'nf-warn': row.overdueRate > 15 }">{{ row.overdueRate.toFixed(1) }}%</span>
          </template>
        </el-table-column>
        <el-table-column label="评级" width="80">
          <template #default="{ row }">
            <el-tag :type="ratingTagType(row.rating)" size="small">{{ row.rating }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="paymentTerms" label="付款条件" width="140" show-overflow-tooltip />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openEdit(row)">编辑</el-button>
            <el-button type="danger" link @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="visible" :title="isEdit ? '编辑供应商' : '新建供应商'" width="560px" destroy-on-close>
      <el-form :model="form" label-width="90px">
        <el-form-item label="供应商">
          <el-input v-model="form.name" maxlength="40" />
        </el-form-item>
        <el-form-item label="联系人">
          <el-input v-model="form.contact" maxlength="20" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="电话">
              <el-input v-model="form.phone" maxlength="20" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="邮箱">
              <el-input v-model="form.email" maxlength="60" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="地址">
          <el-input v-model="form.address" maxlength="100" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="交期(天)">
              <el-input-number v-model="form.leadDays" :min="0" :max="365" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="类别">
              <el-input v-model="form.category" maxlength="20" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="付款条件">
          <el-input v-model="form.paymentTerms" maxlength="40" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="onSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { storeToRefs } from 'pinia'
import { useSupplierStore } from '@/stores/suppliers'
import { usePurchaseOrderStore } from '@/stores/purchaseOrders'

const supplierStore = useSupplierStore()
const purchaseStore = usePurchaseOrderStore()
const { list } = storeToRefs(supplierStore)
const { orders: purchaseOrders } = storeToRefs(purchaseStore)
const today = new Date().toISOString().slice(0, 10)

function calcLineFinishDate(po, lineIndex) {
  const arrivals = (po.arrivals || [])
    .filter((a) => Number(a?.lineIndex) === lineIndex)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
  const target = Number(po?.lines?.[lineIndex]?.qty) || 0
  let sum = 0
  for (const a of arrivals) {
    sum += Number(a?.qty) || 0
    if (sum >= target) return String(a?.date || '')
  }
  return ''
}

function calcSupplierPerf(row) {
  const matchedPos = purchaseOrders.value.filter(
    (po) => (row.id && po.supplierId === row.id) || String(po.supplier || '').trim() === String(row.name || '').trim(),
  )
  let lineCount = 0
  let overdueCount = 0
  for (const po of matchedPos) {
    for (let i = 0; i < (po.lines || []).length; i += 1) {
      const line = po.lines[i]
      const due = String(line?.due || '')
      if (!due) continue
      const ordered = Number(line?.qty) || 0
      const received = Number(line?.receivedQty) || 0
      lineCount += 1
      if (received >= ordered) {
        const finishDate = calcLineFinishDate(po, i)
        if (finishDate && finishDate > due) overdueCount += 1
      } else if (today > due) {
        overdueCount += 1
      }
    }
  }
  const overdueRate = lineCount > 0 ? (overdueCount / lineCount) * 100 : 0
  const rating = overdueRate <= 5 ? 'A' : overdueRate <= 15 ? 'B' : overdueRate <= 30 ? 'C' : 'D'
  return {
    poCount: matchedPos.length,
    lineCount,
    overdueRate,
    rating,
  }
}

const rows = computed(() =>
  list.value.map((x) => {
    const perf = calcSupplierPerf(x)
    return {
      ...x,
      ...perf,
    }
  }),
)

const visible = ref(false)
const isEdit = ref(false)
const form = reactive(emptyForm())

function emptyForm() {
  return {
    id: '',
    name: '',
    contact: '',
    phone: '',
    email: '',
    address: '',
    leadDays: 0,
    paymentTerms: '',
    category: '',
    enabled: true,
  }
}

function openEdit(row) {
  if (row) {
    isEdit.value = true
    Object.assign(form, { ...row })
  } else {
    isEdit.value = false
    Object.assign(form, emptyForm())
  }
  visible.value = true
}

function onSave() {
  if (!String(form.name || '').trim()) {
    ElMessage.warning('请填写供应商名称')
    return
  }
  supplierStore.upsert({
    ...form,
    id: form.id || `SUP-${Date.now()}`,
  })
  visible.value = false
  ElMessage.success('已保存供应商')
}

function ratingTagType(rating) {
  if (rating === 'A') return 'success'
  if (rating === 'B') return 'primary'
  if (rating === 'C') return 'warning'
  return 'danger'
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除供应商「${row.name}」？`, '提示', { type: 'warning' })
  } catch {
    return
  }
  const ok = supplierStore.remove(row.id)
  if (!ok) ElMessage.warning('删除失败')
  else ElMessage.success('已删除')
}
</script>

<style scoped>
.nf-page {
  max-width: 1200px;
  margin: 0 auto;
}
.nf-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
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
.nf-warn {
  color: #b45309;
  font-weight: 600;
}
</style>
