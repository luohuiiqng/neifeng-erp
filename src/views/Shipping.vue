<template>
  <div class="nf-page">
    <el-card shadow="never">
      <template #header>
        <div class="nf-ship-head">
          <span class="nf-head">出货确认</span>
          <span class="nf-ship-hint"><strong>出货提交</strong>由具备「操作·出货确认提交」的<strong>车间主任</strong>（或管理员）操作；须生产订单为<strong>待出货</strong>且<strong>厂长已同意出货</strong>后方可提交。其他角色可查看但无提交按钮。</span>
        </div>
      </template>
      <el-form :model="form" label-width="120px" class="nf-form">
        <el-form-item label="关联生产订单">
          <el-select v-model="form.orderId" filterable placeholder="选择生产订单" style="width: 100%; max-width: 400px">
            <el-option v-for="o in orders" :key="o.id" :label="`${o.id} · ${o.customer}`" :value="o.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="出货日期">
          <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
        </el-form-item>
        <el-form-item label="发货负责人">
          <el-input v-model="form.manager" placeholder="如：车间主任" style="max-width: 320px" />
        </el-form-item>
        <el-form-item label="本批次台数">
          <el-input-number v-model="form.qty" :min="1" :max="99" />
        </el-form-item>
        <el-form-item label="物流单号">
          <el-input v-model="form.tracking" placeholder="可选" style="max-width: 400px" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.note" type="textarea" rows="3" placeholder="签收约定、木箱编号等" style="max-width: 560px" />
        </el-form-item>
        <el-form-item>
          <el-button v-if="rolesStore.can('action_ship_submit')" type="primary" @click="onSubmit">确认出货</el-button>
          <el-button @click="onReset">重置</el-button>
          <span v-if="!rolesStore.can('action_ship_submit')" class="nf-no-perm">出货确认须车间主任权限（或管理员）</span>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { useProductionOrderStore } from '@/stores/productionOrders'
import { useRolesStore } from '@/stores/roles'

const route = useRoute()
const rolesStore = useRolesStore()
const poStore = useProductionOrderStore()
const { orders } = storeToRefs(poStore)

const form = reactive({
  orderId: '',
  date: '2026-04-12',
  manager: '车间主任',
  qty: 1,
  tracking: '',
  note: '',
})

const selectedOrder = computed(() => orders.value.find((o) => o.id === form.orderId))

onMounted(() => {
  const q = route.query.order
  if (q) form.orderId = q
  else if (orders.value[1]) form.orderId = orders.value[1].id
})

function onSubmit() {
  if (!rolesStore.can('action_ship_submit')) {
    ElMessage.warning('无权限')
    return
  }
  if (!selectedOrder.value) {
    ElMessage.warning('请选择关联生产订单')
    return
  }
  if (selectedOrder.value.status !== '待出货') {
    ElMessage.warning('仅待出货状态可提交出货')
    return
  }
  if (!selectedOrder.value.shipReleaseApproved) {
    ElMessage.warning('该订单尚未经厂长同意出货，暂不可出货')
    return
  }
  poStore.recordShipment(form.orderId, form.qty)
  ElMessage.success('已提交出货并登记数量')
}

function onReset() {
  form.tracking = ''
  form.note = ''
  form.qty = 1
}
</script>

<style scoped>
.nf-page {
  max-width: 720px;
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
  max-width: 640px;
}
.nf-no-perm {
  margin-left: 12px;
  font-size: 13px;
  color: #9ca3af;
}
</style>
