<template>
  <div class="nf-page">
    <el-card shadow="never">
      <div class="nf-toolbar">
        <span class="nf-toolbar__title">采购申请</span>
        <el-button type="primary" @click="openSampleRequest">打开示例申请</el-button>
      </div>
      <el-table :data="purchaseRequests" stripe style="width: 100%; margin-top: 16px">
        <el-table-column prop="id" label="申请单号" width="160" />
        <el-table-column prop="productionOrderId" label="关联生产订单" width="168" />
        <el-table-column prop="applicant" label="申请人" width="100" />
        <el-table-column prop="date" label="申请日期" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === '已通过' ? 'success' : 'warning'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="88" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="$router.push(`/purchase/requests/${row.id}`)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <p class="nf-note">库存账与库位由仓库模块管理；到货在采购订单中登记。</p>
    </el-card>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { purchaseRequests } from '@/mock/data'

const router = useRouter()
function openSampleRequest() {
  router.push('/purchase/requests/PR-2026-0320-01')
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
}
.nf-toolbar__title {
  font-weight: 600;
  font-size: 15px;
}
.nf-note {
  margin: 16px 0 0;
  font-size: 12px;
  color: #9ca3af;
}
</style>
