<template>
  <div class="nf-page">
    <el-card shadow="never">
      <div class="nf-toolbar">
        <div class="nf-toolbar__left">
          <el-input v-model="keyword" clearable placeholder="搜索客户 / 生产订单号" style="width: 280px">
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-select v-model="statusFilter" clearable placeholder="状态" style="width: 140px">
            <el-option label="全部" value="" />
            <el-option v-if="rolesStore.canViewDraftProductionOrder()" label="草稿（未下发）" value="草稿" />
            <el-option label="已下发" value="已下发" />
            <el-option label="设计中" value="设计中" />
            <el-option label="备货中" value="备货中" />
            <el-option label="生产中" value="生产中" />
            <el-option label="待出货审批" value="待出货审批" />
            <el-option label="待出货" value="待出货" />
            <el-option label="已结案" value="已结案" />
          </el-select>
        </div>
        <el-button
          v-if="rolesStore.can('action_mo_create')"
          type="primary"
          @click="$router.push('/production-orders/new')"
        >
          <el-icon class="el-icon--left"><Plus /></el-icon>
          新建生产订单
        </el-button>
      </div>
      <p class="nf-hint">
        生产订单由<strong>厂长</strong>新建；保存后为<strong>草稿（未下发）</strong>，仅厂长（及管理员）可见；厂长在详情点<strong>下发</strong>后为<strong>已下发</strong>，车间主任判读设计需求并推进<strong>备货 / 生产</strong>；生产结束后申请<strong>待出货审批</strong>，厂长同意后为<strong>待出货</strong>。数据保存在本浏览器本地。
      </p>
      <el-table :data="filtered" stripe style="width: 100%; margin-top: 12px">
        <el-table-column prop="id" label="生产订单号" width="168" />
        <el-table-column prop="customer" label="客户/项目" min-width="120" />
        <el-table-column prop="signedAt" label="下达日期" width="118" />
        <el-table-column prop="dueDate" label="要求交期" width="118" />
        <el-table-column prop="totalQty" label="台数" width="72" align="center" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="tagType(row.status)" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="owner" label="创建人" width="100" />
        <el-table-column label="操作" width="88" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="$router.push(`/production-orders/${row.id}`)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { Plus, Search } from '@element-plus/icons-vue'
import { useProductionOrderStore } from '@/stores/productionOrders'
import { useRolesStore } from '@/stores/roles'

const poStore = useProductionOrderStore()
const rolesStore = useRolesStore()
const { orders } = storeToRefs(poStore)

const keyword = ref('')
const statusFilter = ref('')

const filtered = computed(() =>
  orders.value.filter((o) => {
    if (o.status === '草稿' && !rolesStore.canViewDraftProductionOrder()) return false
    const k = keyword.value.trim()
    const matchK =
      !k || o.customer.includes(k) || o.id.toLowerCase().includes(k.toLowerCase())
    const matchS = !statusFilter.value || o.status === statusFilter.value
    return matchK && matchS
  }),
)

function tagType(s) {
  const m = {
    草稿: 'info',
    已下发: 'info',
    设计中: 'warning',
    备货中: 'warning',
    生产中: 'primary',
    待出货审批: 'warning',
    待出货: 'success',
    已结案: 'success',
  }
  return m[s] || 'info'
}
</script>

<style scoped>
.nf-page {
  max-width: 1280px;
  margin: 0 auto;
}
.nf-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.nf-toolbar__left {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.nf-hint {
  margin: 12px 0 0;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
}
</style>
