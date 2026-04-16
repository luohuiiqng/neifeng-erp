<template>
  <div class="nf-page" v-if="req">
    <el-page-header @back="$router.push('/purchase/requests')" content="采购申请详情" class="nf-back" />
    <el-card shadow="never" class="nf-row-mt">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="申请单号">{{ req.id }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusType(req.status)">{{ req.status }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="关联生产订单">
          <el-button type="primary" link @click="$router.push(`/production-orders/${req.productionOrderId}`)">
            {{ req.productionOrderId }}
          </el-button>
        </el-descriptions-item>
        <el-descriptions-item label="申请日期">{{ req.date }}</el-descriptions-item>
        <el-descriptions-item label="申请人">{{ req.applicant }}</el-descriptions-item>
      </el-descriptions>
      <p class="nf-tip">
        典型流程：采购申请提交审批后，审批通过再进入采购订单执行；审批退回时可补充明细后再次提交。
      </p>
      <h4 class="nf-h4">申请明细</h4>
      <el-table :data="req.lines" stripe border>
        <el-table-column type="index" width="50" />
        <el-table-column label="物料编码" width="190">
          <template #default="{ row, $index }">
            <el-select
              v-if="canLinkMaterial"
              :model-value="row.materialCode"
              filterable
              placeholder="选择仓库物料"
              style="width: 100%"
              @change="(val) => onPickMaterial($index, val)"
            >
              <el-option
                v-for="m in materialOptions"
                :key="m.code"
                :label="`${m.code} · ${m.name} · ${m.spec || '—'}`"
                :value="m.code"
              />
            </el-select>
            <span v-else>{{ row.materialCode || '未关联' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="desc" label="物料描述" min-width="140" />
        <el-table-column prop="spec" label="规格" width="100" />
        <el-table-column prop="qty" label="数量" width="72" align="center" />
        <el-table-column prop="unit" label="单位" width="64" />
        <el-table-column prop="needDate" label="需求日期" width="118" />
        <el-table-column prop="supplier" label="建议供应商" width="120" />
        <el-table-column prop="note" label="备注" min-width="120" show-overflow-tooltip />
      </el-table>
      <p v-if="missingMaterialCount > 0" class="nf-warn">
        当前有 {{ missingMaterialCount }} 行未关联仓库物料，不能提交审批或创建采购订单。
      </p>
      <div class="nf-actions">
        <el-button
          v-for="po in linkedOrders"
          :key="po.id"
          type="primary"
          plain
          @click="$router.push(`/purchase/orders/${po.id}`)"
        >
          查看采购单 {{ po.id }}
        </el-button>
        <el-button v-if="!linkedOrders.length" type="info" plain disabled>当前采购申请暂无关联采购订单</el-button>
        <el-tooltip :disabled="rolesStore.can('purchase')" :content="permissionTip('purchase')" placement="top">
          <span>
            <el-button
              type="primary"
              :disabled="!rolesStore.can('purchase') || !canCreatePo || missingMaterialCount > 0"
              @click="openCreatePo"
            >
              新建采购订单
            </el-button>
          </span>
        </el-tooltip>
        <el-tooltip
          v-if="canSubmitApproval"
          :disabled="rolesStore.can('action_pr_submit')"
          :content="permissionTip('action_pr_submit')"
          placement="top"
        >
          <span>
            <el-button
              type="warning"
              :disabled="!rolesStore.can('action_pr_submit') || missingMaterialCount > 0"
              @click="onSubmitPr"
            >
              提交审批
            </el-button>
          </span>
        </el-tooltip>
      </div>
      <p v-if="rolesStore.can('purchase') && !canCreatePo" class="nf-warn">
        当前状态为「{{ req.status }}」，需审批通过后才能创建采购订单。
      </p>
    </el-card>

    <el-dialog v-model="createPoVisible" title="新建采购订单" width="520px" destroy-on-close>
      <el-form :model="createPoForm" label-width="90px">
        <el-form-item label="供应商">
          <el-select v-model="createPoForm.supplierId" filterable style="width: 100%" placeholder="选择供应商">
            <el-option
              v-for="s in supplierOptions"
              :key="s.id"
              :label="`${s.name} · ${s.contact || '—'} · ${s.phone || '—'}`"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="下单日期">
          <el-date-picker v-model="createPoForm.date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
      </el-form>
      <p class="nf-tip">将按本申请明细自动生成采购订单行，单价/金额可在采购单详情继续完善。</p>
      <template #footer>
        <el-button @click="createPoVisible = false">取消</el-button>
        <el-button type="primary" @click="onCreatePo">创建并进入采购单</el-button>
      </template>
    </el-dialog>
  </div>
  <el-empty v-else description="未找到申请单" />
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useRolesStore } from '@/stores/roles'
import { usePurchaseRequestStore } from '@/stores/purchaseRequests'
import { useApprovalsStore } from '@/stores/approvals'
import { usePurchaseOrderStore } from '@/stores/purchaseOrders'
import { useWarehouseStore } from '@/stores/warehouse'
import { useSupplierStore } from '@/stores/suppliers'
import { permissionTip } from '@/utils/permissionMeta'

const route = useRoute()
const router = useRouter()
const rolesStore = useRolesStore()
const requestStore = usePurchaseRequestStore()
const approvalsStore = useApprovalsStore()
const purchaseStore = usePurchaseOrderStore()
const warehouseStore = useWarehouseStore()
const supplierStore = useSupplierStore()
const req = computed(() => requestStore.getById(route.params.id))
const linkedOrders = computed(() => {
  if (!req.value) return []
  return purchaseStore.listByRequestId(req.value.id)
})
const canSubmitApproval = computed(() => {
  const s = req.value?.status
  return s === '草稿' || s === '已退回'
})
const canCreatePo = computed(() => req.value?.status === '已通过')
const canLinkMaterial = computed(() => {
  const s = req.value?.status
  return rolesStore.can('purchase') && (s === '草稿' || s === '已退回')
})
const materialOptions = computed(() => warehouseStore.data.materials)
const missingMaterialCount = computed(() => {
  if (!req.value) return 0
  return (req.value.lines || []).filter((l) => !warehouseStore.materialByCode(l.materialCode)).length
})
const createPoVisible = ref(false)
const createPoForm = reactive({
  supplierId: '',
  supplier: '',
  date: '',
})
const supplierOptions = computed(() => supplierStore.enabledOptions())

function nowTimeStr() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function onSubmitPr() {
  if (!rolesStore.can('action_pr_submit')) {
    ElMessage.warning(permissionTip('action_pr_submit'))
    return
  }
  if (!req.value) return
  if (!canSubmitApproval.value) {
    ElMessage.warning('当前状态不可重复提交审批')
    return
  }
  if (approvalsStore.hasPendingTypeRef('采购申请', req.value.id)) {
    ElMessage.warning('该申请已有待审批记录，请勿重复提交')
    return
  }
  const vr = requestStore.validateRequestForSubmit(req.value.id)
  if (!vr.ok) {
    ElMessage.warning(vr.message || '提交失败')
    return
  }
  const ok = requestStore.submitApproval(req.value.id)
  if (!ok) {
    ElMessage.warning('提交失败，请刷新重试')
    return
  }
  approvalsStore.addPending({
    id: `AP-PR-${req.value.id}-${Date.now()}`,
    type: '采购申请',
    ref: req.value.id,
    customer: req.value.productionOrderId || '—',
    submitter: rolesStore.currentRole?.name || req.value.applicant || '采购',
    time: nowTimeStr(),
  })
  ElMessage.success('已提交审批，请在审批中心处理')
}

function openCreatePo() {
  if (!canCreatePo.value || missingMaterialCount.value > 0) return
  createPoForm.supplierId = ''
  createPoForm.supplier = ''
  createPoForm.date = req.value?.date || ''
  createPoVisible.value = true
}

function onCreatePo() {
  if (!req.value) return
  if (!canCreatePo.value) {
    ElMessage.warning('当前状态不可新建采购订单')
    return
  }
  if (!createPoForm.supplierId) {
    ElMessage.warning('请选择供应商')
    return
  }
  const vr = requestStore.validateRequestForSubmit(req.value.id)
  if (!vr.ok) {
    ElMessage.warning(vr.message || '请先完成物料关联')
    return
  }
  const id = purchaseStore.createFromRequest(req.value, {
    supplierId: createPoForm.supplierId,
    supplier: createPoForm.supplier,
    date: createPoForm.date,
  })
  if (!id) {
    ElMessage.warning('创建失败，请确认申请明细后重试')
    return
  }
  createPoVisible.value = false
  ElMessage.success(`已创建采购订单 ${id}`)
  router.push(`/purchase/orders/${id}`)
}

function onPickMaterial(lineIndex, materialCode) {
  if (!req.value) return
  const ok = requestStore.setLineMaterialCode(req.value.id, lineIndex, materialCode)
  if (!ok) ElMessage.warning('物料选择失败，请重试')
}

function statusType(status) {
  if (status === '已通过') return 'success'
  if (status === '已退回') return 'danger'
  if (status === '待审批') return 'warning'
  return 'info'
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
.nf-tip {
  margin: 12px 0 0;
  font-size: 12px;
  color: #6b7280;
}
.nf-warn {
  margin-top: 10px;
  font-size: 12px;
  color: #b45309;
}
</style>
