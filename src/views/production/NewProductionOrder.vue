<template>
  <div class="nf-page">
    <el-page-header @back="onCancel" content="新建生产订单" class="nf-back" />

    <el-card shadow="never" class="nf-card">
      <p class="nf-lead">
        由<strong>厂长</strong>新建（保存后为<strong>草稿</strong>，仅厂长与管理员可见）。明细列为：<strong>单位名称、机型、冷/热、缝包、台数、打孔、备注</strong>，至少一行且须填机型与台数。厂长在详情<strong>下发</strong>后，由车间主任判读是否需设计并推进备货与生产。
      </p>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" class="nf-form">
        <el-divider content-position="left">主信息</el-divider>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="客户/项目" prop="customer">
              <el-autocomplete
                v-model="form.customer"
                :fetch-suggestions="queryCustomerNames"
                placeholder="可联想主数据中的客户，或直接输入"
                maxlength="80"
                clearable
                style="width: 100%"
                @select="onCustomerPick"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户类型" prop="customerType">
              <el-select v-model="form.customerType" placeholder="选择" style="width: 100%">
                <el-option label="国内" value="国内" />
                <el-option label="出口" value="出口" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="下达日期" prop="signedAt">
              <el-date-picker
                v-model="form.signedAt"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="选择日期"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="要求交期" prop="dueDate">
              <el-date-picker
                v-model="form.dueDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="选择日期"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="创建人" prop="owner">
              <el-input v-model="form.owner" placeholder="默认徐总，可改" maxlength="20" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="允许分批出货">
              <el-switch v-model="form.allowPartialShip" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input
                v-model="form.remark"
                type="textarea"
                :rows="2"
                placeholder="首条主信息备注；保存后可在详情按时间追加更多条，并设高优先级（红色）"
                maxlength="500"
                show-word-limit
              />
            </el-form-item>
          </el-col>
          <el-col v-if="rolesStore.canViewOrderFinancials()" :span="12">
            <el-form-item label="合同金额">
              <el-input-number v-model="form.contractAmount" :min="0" :step="1000" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col v-if="rolesStore.canViewOrderFinancials()" :span="12">
            <el-form-item label="已回款">
              <el-input-number v-model="form.receivedAmount" :min="0" :step="1000" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">订单明细</el-divider>
        <div class="nf-lines-toolbar">
          <el-button type="primary" link @click="addLine">
            <el-icon><Plus /></el-icon>
            添加一行
          </el-button>
        </div>
        <el-table :data="form.lines" border stripe class="nf-lines-table">
          <el-table-column label="单位名称" width="120">
            <template #default="{ row }">
              <el-input v-model="row.unit" placeholder="如：徐州立峰" maxlength="40" />
            </template>
          </el-table-column>
          <el-table-column label="机型" min-width="140">
            <template #default="{ row }">
              <el-input v-model="row.model" placeholder="必填" />
            </template>
          </el-table-column>
          <el-table-column label="冷/热" min-width="110">
            <template #default="{ row }">
              <el-input v-model="row.temp" placeholder="文本描述" maxlength="80" />
            </template>
          </el-table-column>
          <el-table-column label="缝包" min-width="100">
            <template #default="{ row }">
              <el-input v-model="row.stitch" placeholder="如：单针/双针" maxlength="40" />
            </template>
          </el-table-column>
          <el-table-column label="台数" width="120">
            <template #default="{ row }">
              <el-input-number v-model="row.qty" :min="1" :max="9999" controls-position="right" style="width: 100%" />
            </template>
          </el-table-column>
          <el-table-column label="打孔" width="100">
            <template #default="{ row }">
              <el-input v-model="row.punch" placeholder="—" maxlength="40" />
            </template>
          </el-table-column>
          <el-table-column label="备注" min-width="140">
            <template #default="{ row }">
              <el-input v-model="row.note" type="textarea" :rows="1" placeholder="选配、客户强调项" maxlength="500" />
            </template>
          </el-table-column>
          <el-table-column label="" width="72" fixed="right">
            <template #default="{ $index }">
              <el-button type="danger" link :disabled="form.lines.length <= 1" @click="removeLine($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="nf-footer-actions">
          <el-button @click="onCancel">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="onSubmit">保存并生成订单</el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useProductionOrderStore } from '@/stores/productionOrders'
import { useCustomerStore } from '@/stores/customers'
import { useRolesStore } from '@/stores/roles'

const router = useRouter()
const poStore = useProductionOrderStore()
const customerStore = useCustomerStore()
const rolesStore = useRolesStore()

function queryCustomerNames(queryStr, cb) {
  const names = customerStore.nameOptions()
  const q = String(queryStr || '').trim().toLowerCase()
  const filtered = q ? names.filter((n) => n.toLowerCase().includes(q)) : names
  cb(filtered.map((value) => ({ value })))
}

function onCustomerPick(item) {
  const m = customerStore.list.find((c) => String(c.name || '').trim() === String(item?.value || '').trim())
  if (m) form.customerType = m.customerType === '出口' ? '出口' : '国内'
}

const formRef = ref()
const submitting = ref(false)

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const form = reactive({
  customer: '',
  customerType: '国内',
  signedAt: todayStr(),
  dueDate: '',
  owner: '',
  remark: '',
  allowPartialShip: true,
  contractAmount: 0,
  receivedAmount: 0,
  lines: [
    { unit: '', model: '', temp: '', stitch: '', qty: 1, punch: '—', note: '' },
  ],
})

onMounted(() => {
  const r = rolesStore.currentRole
  if (r?.code === 'admin') form.owner = '徐总'
  else if (r?.code === 'director') form.owner = (r.name || '厂长').trim() || '厂长'
  else form.owner = '徐总'
})

const rules = {
  customer: [{ required: true, message: '请填写客户/项目', trigger: 'blur' }],
  signedAt: [{ required: true, message: '请选择下达日期', trigger: 'change' }],
  dueDate: [{ required: true, message: '请选择要求交期', trigger: 'change' }],
  owner: [{ required: true, message: '请填写创建人', trigger: 'blur' }],
}

function addLine() {
  form.lines.push({ unit: '', model: '', temp: '', stitch: '', qty: 1, punch: '—', note: '' })
}

function removeLine(i) {
  if (form.lines.length <= 1) return
  form.lines.splice(i, 1)
}

function onCancel() {
  router.push('/production-orders')
}

async function onSubmit() {
  try {
    await formRef.value?.validate()
  } catch {
    ElMessage.warning('请完善标红项')
    return
  }
  for (let i = 0; i < form.lines.length; i += 1) {
    const l = form.lines[i]
    if (!l.model?.trim()) {
      ElMessage.warning(`第 ${i + 1} 行请填写机型`)
      return
    }
    if (!l.qty || l.qty < 1) {
      ElMessage.warning(`第 ${i + 1} 行台数至少为 1`)
      return
    }
  }
  submitting.value = true
  try {
    const id = poStore.addOrder({
      ...form,
      lines: form.lines.map((l) => ({ ...l })),
    })
    ElMessage.success(`已生成生产订单 ${id}（草稿）`)
    router.replace(`/production-orders/${id}`)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.nf-page {
  max-width: 960px;
  margin: 0 auto;
}
.nf-back :deep(.el-page-header__content) {
  font-weight: 600;
  font-size: 16px;
}
.nf-card {
  margin-top: 16px;
}
.nf-lead {
  margin: 0 0 20px;
  font-size: 14px;
  color: #4b5563;
  line-height: 1.6;
}
.nf-form {
  max-width: 100%;
}
.nf-lines-toolbar {
  margin-bottom: 8px;
}
.nf-lines-table {
  margin-bottom: 20px;
}
.nf-footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 8px;
}
</style>
