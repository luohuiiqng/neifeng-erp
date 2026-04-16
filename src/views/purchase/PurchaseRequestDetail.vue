<template>
  <div class="nf-page" v-if="req">
    <el-page-header @back="$router.push('/purchase/requests')" content="采购申请详情" class="nf-back" />
    <el-card shadow="never" class="nf-row-mt">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="申请单号">{{ req.id }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="req.status === '已通过' ? 'success' : 'warning'">{{ req.status }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="关联生产订单">
          <el-button type="primary" link @click="$router.push(`/production-orders/${req.productionOrderId}`)">
            {{ req.productionOrderId }}
          </el-button>
        </el-descriptions-item>
        <el-descriptions-item label="申请日期">{{ req.date }}</el-descriptions-item>
        <el-descriptions-item label="申请人">{{ req.applicant }}</el-descriptions-item>
      </el-descriptions>
      <h4 class="nf-h4">申请明细</h4>
      <el-table :data="req.lines" stripe border>
        <el-table-column type="index" width="50" />
        <el-table-column prop="desc" label="物料描述" min-width="140" />
        <el-table-column prop="spec" label="规格" width="100" />
        <el-table-column prop="qty" label="数量" width="72" align="center" />
        <el-table-column prop="unit" label="单位" width="64" />
        <el-table-column prop="needDate" label="需求日期" width="118" />
        <el-table-column prop="supplier" label="建议供应商" width="120" />
        <el-table-column prop="note" label="备注" min-width="120" show-overflow-tooltip />
      </el-table>
      <div class="nf-actions">
        <el-button type="primary" @click="$router.push('/purchase/orders/PO-2026-0321-01')">查看关联采购订单</el-button>
        <el-button v-if="rolesStore.can('action_pr_submit')" @click="onSubmitPr">提交审批</el-button>
      </div>
    </el-card>
  </div>
  <el-empty v-else description="未找到申请单" />
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { purchaseRequests } from '@/mock/data'
import { useRolesStore } from '@/stores/roles'

const route = useRoute()
const rolesStore = useRolesStore()
const req = computed(() => purchaseRequests.find((r) => r.id === route.params.id))

function onSubmitPr() {
  if (!rolesStore.can('action_pr_submit')) {
    ElMessage.warning('当前角色无「提交采购申请审批」权限')
    return
  }
  ElMessage.success('已提交')
}
</script>

<style scoped>
.nf-page {
  max-width: 1000px;
  margin: 0 auto;
}
.nf-back :deep(.el-page-header__content) {
  font-weight: 600;
}
.nf-row-mt {
  margin-top: 16px;
}
.nf-h4 {
  margin: 20px 0 12px;
  font-size: 15px;
}
.nf-actions {
  margin-top: 20px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
</style>
