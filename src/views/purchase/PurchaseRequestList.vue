<template>
  <div class="nf-page">
    <el-card shadow="never">
      <div class="nf-toolbar">
        <div class="nf-toolbar__left">
          <span class="nf-toolbar__title">采购申请</span>
          <el-input v-model="kw" clearable placeholder="筛选申请单/生产单/申请人" style="width: 260px" />
          <el-select v-model="statusFilter" clearable placeholder="状态" style="width: 140px">
            <el-option label="全部" value="" />
            <el-option label="草稿" value="草稿" />
            <el-option label="待审批" value="待审批" />
            <el-option label="已通过" value="已通过" />
            <el-option label="已退回" value="已退回" />
          </el-select>
        </div>
        <div class="nf-toolbar__right">
          <el-tag type="warning" effect="plain">待审批 {{ pendingCount }}</el-tag>
          <el-tooltip :disabled="rolesStore.can('purchase')" :content="permissionTip('purchase')" placement="top">
            <span>
              <el-button type="primary" :disabled="!rolesStore.can('purchase')" @click="openCreatePr">新建采购申请</el-button>
            </span>
          </el-tooltip>
          <el-tooltip :disabled="rolesStore.can('purchase')" :content="permissionTip('purchase')" placement="top">
            <span>
              <el-button
                type="primary"
                :disabled="!rolesStore.can('purchase') || !approvedReadyRequests.length"
                @click="openCreatePo()"
              >
                新建采购订单
              </el-button>
            </span>
          </el-tooltip>
        </div>
      </div>
      <el-table :data="rows" stripe style="width: 100%; margin-top: 16px">
        <el-table-column prop="id" label="申请单号" width="160" />
        <el-table-column prop="productionOrderId" label="关联生产订单" width="168" />
        <el-table-column prop="applicant" label="申请人" width="100" />
        <el-table-column prop="date" label="申请日期" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="$router.push(`/purchase/requests/${row.id}`)">详情</el-button>
            <el-tooltip
              v-if="row.status === '已通过' && isRequestReady(row)"
              :disabled="rolesStore.can('purchase')"
              :content="permissionTip('purchase')"
              placement="top"
            >
              <span>
                <el-button
                  type="success"
                  link
                  :disabled="!rolesStore.can('purchase')"
                  @click="openCreatePo(row)"
                >
                  新建采购单
                </el-button>
              </span>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
      <p class="nf-note nf-note--warn">
        仅“已通过且明细全部关联仓库物料”的申请可创建采购订单。未关联时请先进入详情完成物料绑定。
      </p>
      <p class="nf-note">库存账与库位由仓库模块管理；到货在采购订单中登记。</p>
    </el-card>

    <el-dialog v-model="createPrVisible" title="新建采购申请" width="900px" destroy-on-close>
      <el-form :model="createPrForm" label-width="100px">
        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="关联生产单">
              <el-select v-model="createPrForm.productionOrderId" filterable style="width: 100%" placeholder="选择生产订单">
                <el-option
                  v-for="o in productionOrderOptions"
                  :key="o.id"
                  :label="`${o.id} · ${o.customer} · ${o.status}`"
                  :value="o.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="申请人">
              <el-input v-model="createPrForm.applicant" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="申请日期">
              <el-date-picker v-model="createPrForm.date" value-format="YYYY-MM-DD" type="date" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <div class="nf-lines-head">
        <span>申请明细</span>
        <el-button type="primary" link @click="addPrLine">+ 增加一行</el-button>
      </div>
      <el-table :data="createPrForm.lines" border stripe>
        <el-table-column type="index" width="50" />
        <el-table-column label="物料" min-width="220">
          <template #default="{ row }">
            <el-select
              v-model="row.materialCode"
              filterable
              style="width: 100%"
              placeholder="从仓库主数据选择"
              @change="(val) => onPickPrMaterial(row, val)"
            >
              <el-option
                v-for="m in warehouseMaterials"
                :key="m.code"
                :label="`${m.code} · ${m.name} · ${m.spec || '—'}`"
                :value="m.code"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column prop="desc" label="描述" min-width="140" />
        <el-table-column prop="spec" label="规格" width="120" />
        <el-table-column label="数量" width="100">
          <template #default="{ row }">
            <el-input-number v-model="row.qty" :min="1" :max="9999" />
          </template>
        </el-table-column>
        <el-table-column prop="unit" label="单位" width="70" />
        <el-table-column label="需求日期" width="130">
          <template #default="{ row }">
            <el-date-picker v-model="row.needDate" value-format="YYYY-MM-DD" type="date" />
          </template>
        </el-table-column>
        <el-table-column label="建议供应商" width="140">
          <template #default="{ row }">
            <el-input v-model="row.supplier" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="70" fixed="right">
          <template #default="{ $index }">
            <el-button type="danger" link :disabled="createPrForm.lines.length <= 1" @click="removePrLine($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="createPrVisible = false">取消</el-button>
        <el-button type="primary" @click="onCreatePr">保存为草稿并打开详情</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="createPoVisible" title="新建采购订单" width="560px" destroy-on-close>
      <el-form :model="createPoForm" label-width="100px">
        <el-form-item label="来源申请">
          <el-select v-model="createPoForm.requestId" filterable style="width: 100%" placeholder="选择已通过申请">
            <el-option
              v-for="r in approvedReadyRequests"
              :key="r.id"
              :label="`${r.id} · ${r.productionOrderId || '—'} · ${r.applicant || '—'} · 已关联`"
              :value="r.id"
            />
          </el-select>
        </el-form-item>
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
      <p v-if="!approvedReadyRequests.length" class="nf-note nf-note--warn">
        当前没有可创建采购订单的申请。请先在采购申请详情中完成物料关联并通过审批。
      </p>
      <p class="nf-note">将按申请明细自动生成采购订单，单价和金额可在采购单详情完善。</p>
      <template #footer>
        <el-button @click="createPoVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!selectedRequestReady" @click="onCreatePo">创建并进入采购单</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { usePurchaseRequestStore } from '@/stores/purchaseRequests'
import { usePurchaseOrderStore } from '@/stores/purchaseOrders'
import { useRolesStore } from '@/stores/roles'
import { useProductionOrderStore } from '@/stores/productionOrders'
import { useOrderWorkflowStore } from '@/stores/orderWorkflow'
import { useWarehouseStore } from '@/stores/warehouse'
import { useSupplierStore } from '@/stores/suppliers'
import { permissionTip } from '@/utils/permissionMeta'

const router = useRouter()
const kw = ref('')
const statusFilter = ref('')
const requestStore = usePurchaseRequestStore()
const purchaseStore = usePurchaseOrderStore()
const rolesStore = useRolesStore()
const poStore = useProductionOrderStore()
const workflowStore = useOrderWorkflowStore()
const warehouseStore = useWarehouseStore()
const supplierStore = useSupplierStore()
const { requests } = storeToRefs(requestStore)
const { orders: productionOrders } = storeToRefs(poStore)
const createPrVisible = ref(false)
const createPoVisible = ref(false)
const createPoForm = reactive({
  requestId: '',
  supplierId: '',
  supplier: '',
  date: '',
})
const createPrForm = reactive({
  productionOrderId: '',
  applicant: '',
  date: '',
  lines: [],
})

const rows = computed(() => {
  const k = kw.value.trim()
  return requests.value.filter((r) => {
    const matchK =
      !k ||
      r.id.includes(k) ||
      String(r.productionOrderId || '').includes(k) ||
      String(r.applicant || '').includes(k)
    const matchS = !statusFilter.value || r.status === statusFilter.value
    return matchK && matchS
  })
})

const pendingCount = computed(() => requests.value.filter((r) => r.status === '待审批').length)
const approvedRequests = computed(() => requests.value.filter((r) => r.status === '已通过'))
const approvedReadyRequests = computed(() => approvedRequests.value.filter((r) => isRequestReady(r)))
const selectedRequestReady = computed(() => {
  const req = requestStore.getById(createPoForm.requestId)
  return !!req && isRequestReady(req)
})
const productionOrderOptions = computed(() =>
  productionOrders.value.filter((o) => !workflowStore.isClosedStatus(o.status) && !workflowStore.isDraftStatus(o.status)),
)
const warehouseMaterials = computed(() => warehouseStore.data.materials)
const supplierOptions = computed(() => supplierStore.enabledOptions())

function todayStr() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function statusType(status) {
  if (status === '已通过') return 'success'
  if (status === '已退回') return 'danger'
  if (status === '待审批') return 'warning'
  return 'info'
}

function openCreatePr() {
  createPrForm.productionOrderId = productionOrderOptions.value[0]?.id || ''
  createPrForm.applicant = rolesStore.currentRole?.name || '采购'
  createPrForm.date = todayStr()
  createPrForm.lines = [emptyPrLine()]
  createPrVisible.value = true
}

function emptyPrLine() {
  return {
    materialCode: '',
    desc: '',
    spec: '',
    qty: 1,
    unit: '件',
    needDate: todayStr(),
    supplier: '',
    note: '',
  }
}

function addPrLine() {
  createPrForm.lines.push(emptyPrLine())
}

function removePrLine(i) {
  if (createPrForm.lines.length <= 1) return
  createPrForm.lines.splice(i, 1)
}

function onPickPrMaterial(row, materialCode) {
  const m = warehouseStore.materialByCode(materialCode)
  if (!m) return
  row.materialCode = m.code
  row.desc = m.name
  row.spec = m.spec || ''
  row.unit = m.unit || '件'
}

function onCreatePr() {
  if (!createPrForm.productionOrderId) {
    ElMessage.warning('请选择关联生产单')
    return
  }
  const validLines = createPrForm.lines.filter((l) => l.materialCode && (Number(l.qty) || 0) > 0)
  if (!validLines.length) {
    ElMessage.warning('请至少填写一行有效物料（物料+数量）')
    return
  }
  if (typeof requestStore.createRequest !== 'function') {
    ElMessage.warning('采购申请模块已更新，请刷新页面后重试')
    return
  }
  const id = requestStore.createRequest({
    productionOrderId: createPrForm.productionOrderId,
    applicant: createPrForm.applicant,
    date: createPrForm.date,
    lines: validLines.map((l) => ({ ...l })),
  })
  if (!id) {
    ElMessage.warning('新建失败，请检查数据')
    return
  }
  createPrVisible.value = false
  ElMessage.success(`已创建采购申请 ${id}`)
  router.push(`/purchase/requests/${id}`)
}

function openCreatePo(row) {
  createPoForm.requestId = row?.id || approvedReadyRequests.value[0]?.id || ''
  createPoForm.supplierId = ''
  createPoForm.supplier = ''
  createPoForm.date = row?.date || todayStr()
  createPoVisible.value = true
}

function onCreatePo() {
  const req = requestStore.getById(createPoForm.requestId)
  if (!req) {
    ElMessage.warning('请选择来源申请')
    return
  }
  if (!isRequestReady(req)) {
    ElMessage.warning('该申请仍有未关联仓库物料的明细，请先到详情处理')
    return
  }
  if (!createPoForm.supplierId) {
    ElMessage.warning('请选择供应商')
    return
  }
  const id = purchaseStore.createFromRequest(req, {
    supplierId: createPoForm.supplierId,
    supplier: createPoForm.supplier,
    date: createPoForm.date,
  })
  if (!id) {
    ElMessage.warning('创建失败，请检查申请明细')
    return
  }
  createPoVisible.value = false
  ElMessage.success(`已创建采购订单 ${id}`)
  router.push(`/purchase/orders/${id}`)
}

function isRequestReady(req) {
  if (!req) return false
  const vr = requestStore.validateRequestForSubmit(req.id)
  return !!vr?.ok
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
.nf-toolbar__left,
.nf-toolbar__right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
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
.nf-note--warn {
  color: #b45309;
}
.nf-lines-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 4px 0 10px;
  font-size: 13px;
  color: #374151;
}
</style>
