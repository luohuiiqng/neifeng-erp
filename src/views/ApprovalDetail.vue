<template>
  <div class="nf-page" v-if="item">
    <el-page-header @back="$router.push('/approval')" content="审批处理" class="nf-back" />
    <el-card shadow="never" class="nf-row-mt">
      <el-descriptions title="单据信息" :column="2" border>
        <el-descriptions-item label="审批类型">{{ item.type }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="item.status === '待审批' ? 'warning' : 'success'">{{ item.status }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="关联单号">{{ item.ref }}</el-descriptions-item>
        <el-descriptions-item label="客户/摘要">{{ item.customer }}</el-descriptions-item>
        <el-descriptions-item label="提交人">{{ item.submitter }}</el-descriptions-item>
        <el-descriptions-item label="提交时间">{{ item.time }}</el-descriptions-item>
      </el-descriptions>
      <el-divider />
      <p v-if="item.type === '结案审批'" class="nf-muted">
        结案类审批：具备「操作·审批·结案类」的角色（如厂长）可处理。
      </p>
      <p v-else-if="item.type === '采购申请'" class="nf-muted">
        采购申请：具备「操作·审批·采购申请类」的角色（如车间主任、厂长）可处理。
      </p>
      <p v-else-if="item.type === '采购单财务审核'" class="nf-muted">
        采购单财务审核：仅具备「操作·审批·采购单财务审核」的财务角色（及管理员）可处理；同意后采购单财务状态为「已通过」。
      </p>
      <div class="nf-actions" v-if="item.status === '待审批' && rolesStore.canProcessApproval(item)">
        <el-button type="danger" plain @click="onReject">退回</el-button>
        <el-button type="primary" @click="onApprove">{{ approveLabel }}</el-button>
      </div>
      <p v-else-if="item.status === '待审批'" class="nf-warn">当前角色无权处理此类审批，请联系管理员在「角色管理」中勾选对应操作权限。</p>
    </el-card>
  </div>
  <el-empty v-else description="未找到审批单" />
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useApprovalsStore } from '@/stores/approvals'
import { usePurchaseOrderStore } from '@/stores/purchaseOrders'
import { useRolesStore } from '@/stores/roles'

const route = useRoute()
const router = useRouter()
const rolesStore = useRolesStore()
const approvalsStore = useApprovalsStore()
const purchaseStore = usePurchaseOrderStore()

const item = computed(() => approvalsStore.findById(route.params.id))

const approveLabel = computed(() => {
  const t = item.value?.type
  if (t === '采购申请') return '同意（采购申请）'
  if (t === '采购单财务审核') return '同意（财务审核）'
  return '同意结案'
})

async function onApprove() {
  if (!rolesStore.canProcessApproval(item.value)) {
    ElMessage.warning('无权限')
    return
  }
  await ElMessageBox.confirm('确认同意？', '提示', { type: 'warning' })
  const cur = item.value
  if (!cur) return
  if (cur.type === '采购单财务审核') {
    purchaseStore.setFinanceAudit(cur.ref, '已通过')
  }
  approvalsStore.setStatus(cur.id, '已通过')
  ElMessage.success('已审批通过')
  router.push('/approval')
}

function onReject() {
  if (!rolesStore.canProcessApproval(item.value)) {
    ElMessage.warning('无权限')
    return
  }
  const cur = item.value
  if (!cur) return
  if (cur.type === '采购单财务审核') {
    purchaseStore.setFinanceAudit(cur.ref, '已驳回')
  }
  approvalsStore.setStatus(cur.id, '已退回')
  ElMessage.warning('已退回')
  router.push('/approval')
}
</script>

<style scoped>
.nf-page {
  max-width: 720px;
  margin: 0 auto;
}
.nf-back :deep(.el-page-header__content) {
  font-weight: 600;
}
.nf-row-mt {
  margin-top: 16px;
}
.nf-muted {
  color: #6b7280;
  font-size: 13px;
  line-height: 1.6;
}
.nf-warn {
  margin-top: 12px;
  font-size: 13px;
  color: #b45309;
  line-height: 1.5;
}
.nf-actions {
  margin-top: 20px;
  display: flex;
  gap: 12px;
}
</style>
