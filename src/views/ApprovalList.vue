<template>
  <div class="nf-page">
    <el-card shadow="never">
      <template #header>
        <span class="nf-head">审批中心</span>
      </template>
      <el-table :data="approvalsStore.items" stripe>
        <el-table-column prop="type" label="类型" width="140" />
        <el-table-column prop="ref" label="单号" width="150" />
        <el-table-column prop="customer" label="客户/摘要" min-width="120" />
        <el-table-column prop="submitter" label="提交人" width="100" />
        <el-table-column prop="time" label="提交时间" width="170" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === '待审批' ? 'warning' : 'success'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="rolesStore.canProcessApproval(row)"
              type="primary"
              link
              @click="$router.push(`/approval/${row.id}`)"
            >
              处理
            </el-button>
            <span v-else-if="row.status === '待审批'" class="nf-muted">无权限</span>
            <span v-else class="nf-muted">—</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { useApprovalsStore } from '@/stores/approvals'
import { useRolesStore } from '@/stores/roles'

const approvalsStore = useApprovalsStore()
const rolesStore = useRolesStore()
</script>

<style scoped>
.nf-page {
  max-width: 1000px;
  margin: 0 auto;
}
.nf-head {
  font-weight: 600;
}
.nf-muted {
  color: #9ca3af;
  font-size: 13px;
}
</style>
