<template>
  <div class="nf-page">
    <el-card shadow="never">
      <template #header>
        <div class="nf-toolbar">
          <span class="nf-toolbar__title">财务应收</span>
          <el-input v-model="kw" clearable placeholder="筛选客户" style="width: 200px" />
        </div>
      </template>
      <el-table :data="rows" stripe>
        <el-table-column prop="id" label="来源订单" width="168" />
        <el-table-column prop="customer" label="客户" min-width="120" />
        <el-table-column v-if="rolesStore.canViewOrderFinancials()" prop="contract" label="合同金额" width="120" align="right">
          <template #default="{ row }">¥{{ row.contract.toLocaleString() }}</template>
        </el-table-column>
        <el-table-column v-if="rolesStore.canViewOrderFinancials()" prop="received" label="已收" width="120" align="right">
          <template #default="{ row }">¥{{ row.received.toLocaleString() }}</template>
        </el-table-column>
        <el-table-column v-if="rolesStore.canViewOrderFinancials()" prop="open" label="未收" width="120" align="right">
          <template #default="{ row }">
            <span :class="{ 'nf-warn': row.open > 0 }">¥{{ row.open.toLocaleString() }}</span>
          </template>
        </el-table-column>
        <el-table-column v-if="!rolesStore.canViewOrderFinancials()" label="金额信息" min-width="160">
          <template #default>
            <span class="nf-masked">金额列仅厂长（及管理员）可见；可操作「申请结案」仍以订单数据为准。</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.open <= 0 ? 'success' : 'warning'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="$router.push(`/production-orders/${row.id}`)">生产订单</el-button>
            <el-button
              v-if="row.open <= 0 && row.status !== '已结案' && rolesStore.can('action_finance_apply_close')"
              type="success"
              link
              @click="goClose"
            >
              申请结案
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'
import { useProductionOrderStore } from '@/stores/productionOrders'
import { useRolesStore } from '@/stores/roles'
import { useOrderWorkflowStore } from '@/stores/orderWorkflow'

const router = useRouter()
const kw = ref('')
const rolesStore = useRolesStore()
const wfStore = useOrderWorkflowStore()
const { orders } = storeToRefs(useProductionOrderStore())

const rows = computed(() =>
  orders.value
    .filter((o) => !wfStore.isDraftStatus(o.status))
    .map((o) => {
      const open = o.contractAmount - o.receivedAmount
      return {
        id: o.id,
        customer: o.customer,
        contract: o.contractAmount,
        received: o.receivedAmount,
        open,
        status: open <= 0 ? '待结案' : '未结清',
      }
    })
    .filter((r) => !kw.value.trim() || r.customer.includes(kw.value.trim())),
)

function goClose() {
  if (!rolesStore.can('action_finance_apply_close')) {
    ElMessage.warning('无权限')
    return
  }
  router.push('/approval/AP-001')
}
</script>

<style scoped>
.nf-page {
  max-width: 1100px;
  margin: 0 auto;
}
.nf-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.nf-toolbar__title {
  font-weight: 600;
}
.nf-warn {
  color: #b45309;
  font-weight: 600;
}
.nf-masked {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.45;
}
</style>
