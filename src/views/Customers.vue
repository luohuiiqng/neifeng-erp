<template>
  <div class="nf-page">
    <el-card shadow="never">
      <template #header>
        <div class="nf-toolbar">
          <span class="nf-head">客户管理</span>
          <el-button v-if="rolesStore.can('action_customer_create')" type="primary" @click="openDialog">
            新建客户
          </el-button>
        </div>
      </template>
      <p class="nf-hint">
        <strong>主数据</strong>由厂长在此新建并本地保存；表格同时汇总<strong>非草稿生产订单</strong>中的客户。新建后可在「新建生产订单」客户栏通过联想选用。
      </p>
      <el-table :data="rows" stripe style="margin-top: 12px">
        <el-table-column prop="customer" label="客户/项目" min-width="160" />
        <el-table-column prop="source" label="来源" width="100" />
        <el-table-column prop="customerType" label="类型" width="88" />
        <el-table-column prop="orderCount" label="关联订单数" width="120" align="center" />
        <el-table-column prop="lastDue" label="最近交期" width="118" />
        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="goFirstOrder(row.customer)">订单</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="新建客户" width="480px" destroy-on-close @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="客户/项目" prop="name">
          <el-input v-model="form.name" maxlength="80" show-word-limit placeholder="与生产订单中「客户/项目」一致填写" />
        </el-form-item>
        <el-form-item label="类型" prop="customerType">
          <el-select v-model="form.customerType" style="width: 100%">
            <el-option label="国内" value="国内" />
            <el-option label="出口" value="出口" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="200" show-word-limit placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCustomer">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { useProductionOrderStore } from '@/stores/productionOrders'
import { useCustomerStore } from '@/stores/customers'
import { useRolesStore } from '@/stores/roles'

const router = useRouter()
const rolesStore = useRolesStore()
const poStore = useProductionOrderStore()
const customerStore = useCustomerStore()
const { orders } = storeToRefs(poStore)
const { list: masterList } = storeToRefs(customerStore)

const dialogVisible = ref(false)
const formRef = ref()
const form = reactive({
  name: '',
  customerType: '国内',
  remark: '',
})

const rules = {
  name: [{ required: true, message: '请填写客户/项目名称', trigger: 'blur' }],
  customerType: [{ required: true, message: '请选择类型', trigger: 'change' }],
}

function aggregateFromOrders() {
  const map = new Map()
  for (const o of orders.value) {
    if (o.status === '草稿') continue
    const k = (o.customer || '').trim() || '—'
    const cur = map.get(k) || {
      customer: k,
      customerType: o.customerType || '—',
      orderCount: 0,
      lastDue: '',
    }
    cur.orderCount += 1
    cur.customerType = o.customerType || cur.customerType
    if ((o.dueDate || '') > (cur.lastDue || '')) cur.lastDue = o.dueDate || cur.lastDue
    map.set(k, cur)
  }
  return map
}

const rows = computed(() => {
  const fromOrders = aggregateFromOrders()
  const byName = new Map()

  for (const c of masterList.value) {
    const name = String(c.name || '').trim()
    if (!name) continue
    const agg = fromOrders.get(name)
    byName.set(name, {
      customer: name,
      source: '主数据',
      customerType: c.customerType || '国内',
      orderCount: agg?.orderCount ?? 0,
      lastDue: agg?.lastDue || '—',
      remark: c.remark || '—',
    })
  }

  for (const [name, agg] of fromOrders) {
    if (byName.has(name)) continue
    byName.set(name, {
      customer: name,
      source: '仅订单',
      customerType: agg.customerType,
      orderCount: agg.orderCount,
      lastDue: agg.lastDue || '—',
      remark: '—',
    })
  }

  return [...byName.values()].sort((a, b) => a.customer.localeCompare(b.customer, 'zh-CN'))
})

function openDialog() {
  resetForm()
  dialogVisible.value = true
}

function resetForm() {
  form.name = ''
  form.customerType = '国内'
  form.remark = ''
  formRef.value?.clearValidate?.()
}

async function submitCustomer() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  const r = customerStore.addCustomer({
    name: form.name,
    customerType: form.customerType,
    remark: form.remark,
  })
  if (!r.ok) {
    ElMessage.warning(r.error)
    return
  }
  ElMessage.success('已保存到客户主数据')
  dialogVisible.value = false
}

function goFirstOrder(customer) {
  const o = orders.value.find((x) => x.customer === customer && x.status !== '草稿')
  if (o) router.push(`/production-orders/${o.id}`)
  else ElMessage.info('该客户暂无已下发的生产订单')
}
</script>

<style scoped>
.nf-page {
  max-width: 1000px;
  margin: 0 auto;
}
.nf-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.nf-head {
  font-weight: 600;
}
.nf-hint {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.55;
}
</style>
