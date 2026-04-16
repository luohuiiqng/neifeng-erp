<template>
  <div class="nf-page">
    <el-card shadow="never">
      <template #header>
        <div class="nf-toolbar">
          <div>
            <span class="nf-toolbar__title">订单状态与流转</span>
            <p class="nf-toolbar__desc">
              配置生产订单的状态编码、展示名与标签；再配置「从某状态到某状态」的操作文案、所需操作权限（与角色管理中的「操作·…」一致）及出货审批副作用。若某状态存在多条流转，详情页会以下拉方式让用户选择下一步，减少误点。保存后立即生效。
            </p>
          </div>
          <div class="nf-toolbar__actions">
            <el-button @click="onResetDefaults">恢复内置默认</el-button>
          </div>
        </div>
      </template>

      <el-tabs v-model="tab">
        <el-tab-pane label="订单状态" name="status">
          <el-button type="primary" class="nf-mb" @click="openStatus()">新增状态</el-button>
          <el-table :data="wf.statuses" stripe border>
            <el-table-column prop="sortOrder" label="排序" width="72" align="center" />
            <el-table-column prop="code" label="编码" width="120" />
            <el-table-column prop="name" label="显示名" width="120" />
            <el-table-column prop="tagType" label="标签色" width="100" />
            <el-table-column label="草稿" width="64" align="center">
              <template #default="{ row }">{{ row.isDraft ? '是' : '' }}</template>
            </el-table-column>
            <el-table-column label="结案" width="64" align="center">
              <template #default="{ row }">{{ row.isClosed ? '是' : '' }}</template>
            </el-table-column>
            <el-table-column label="在制统计" width="88" align="center">
              <template #default="{ row }">{{ row.countsAsRunning ? '是' : '' }}</template>
            </el-table-column>
            <el-table-column prop="workshopPanel" label="车间看板分栏" width="120" />
            <el-table-column label="出货页可提交" width="120" align="center">
              <template #default="{ row }">{{ row.allowsShippingSubmit ? '是' : '' }}</template>
            </el-table-column>
            <el-table-column label="操作" width="140" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link @click="openStatus(row)">编辑</el-button>
                <el-button type="danger" link @click="onRemoveStatus(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="状态流转（按钮与权限）" name="trans">
          <el-button type="primary" class="nf-mb" @click="openTrans()">新增流转</el-button>
          <el-table :data="wf.transitions" stripe border>
            <el-table-column prop="sortOrder" label="排序" width="72" align="center" />
            <el-table-column prop="fromCode" label="从状态" width="120" />
            <el-table-column prop="toCode" label="到状态" width="120" />
            <el-table-column prop="label" label="操作文案" min-width="200" />
            <el-table-column prop="permissionKey" label="所需权限 key" width="200" show-overflow-tooltip />
            <el-table-column prop="effect" label="副作用" width="120" />
            <el-table-column label="操作" width="140" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link @click="openTrans(row)">编辑</el-button>
                <el-button type="danger" link @click="onRemoveTrans(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="statusVisible" :title="statusForm.id ? '编辑状态' : '新增状态'" width="560px" destroy-on-close @closed="resetStatusForm">
      <el-form :model="statusForm" label-width="132px">
        <el-form-item label="排序号">
          <el-input-number v-model="statusForm.sortOrder" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item label="状态编码（唯一）">
          <el-input v-model="statusForm.code" maxlength="40" placeholder="如：草稿、已下发" :disabled="!!statusForm.id && statusCodeLocked" />
        </el-form-item>
        <el-form-item label="显示名">
          <el-input v-model="statusForm.name" maxlength="40" />
        </el-form-item>
        <el-form-item label="标签类型">
          <el-select v-model="statusForm.tagType" style="width: 100%">
            <el-option label="info" value="info" />
            <el-option label="success" value="success" />
            <el-option label="warning" value="warning" />
            <el-option label="danger" value="danger" />
            <el-option label="primary" value="primary" />
          </el-select>
        </el-form-item>
        <el-form-item label="草稿（未下发）">
          <el-switch v-model="statusForm.isDraft" />
          <span class="nf-muted">仅此类状态受「查看草稿订单」权限控制</span>
        </el-form-item>
        <el-form-item label="结案类">
          <el-switch v-model="statusForm.isClosed" />
        </el-form-item>
        <el-form-item label="计入在制统计">
          <el-switch v-model="statusForm.countsAsRunning" />
        </el-form-item>
        <el-form-item label="车间看板分栏">
          <el-select v-model="statusForm.workshopPanel" style="width: 100%">
            <el-option label="不分栏" value="none" />
            <el-option label="备货侧（设计中/已下发/备货）" value="stock" />
            <el-option label="生产侧（生产中/出货相关）" value="produce" />
          </el-select>
        </el-form-item>
        <el-form-item label="出货页允许提交">
          <el-switch v-model="statusForm.allowsShippingSubmit" />
          <span class="nf-muted">须同时满足订单上「厂长已同意出货」</span>
        </el-form-item>
        <el-form-item label="附加标签：待审批">
          <el-switch v-model="statusForm.showShipPendingExtra" />
          <span class="nf-muted">详情页主状态旁显示「待厂长出货审批」类提示</span>
        </el-form-item>
        <el-form-item label="附加标签：放行状态">
          <el-switch v-model="statusForm.showShipReleaseExtra" />
          <span class="nf-muted">详情页显示已同意/待同意出货</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="statusVisible = false">取消</el-button>
        <el-button type="primary" @click="submitStatus">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="transVisible" :title="transForm.id ? '编辑流转' : '新增流转'" width="600px" destroy-on-close @closed="resetTransForm">
      <el-form :model="transForm" label-width="120px">
        <el-form-item label="排序号">
          <el-input-number v-model="transForm.sortOrder" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item label="从状态">
          <el-select v-model="transForm.fromCode" filterable style="width: 100%">
            <el-option v-for="s in wf.statuses" :key="s.code" :label="`${s.code} · ${s.name}`" :value="s.code" />
          </el-select>
        </el-form-item>
        <el-form-item label="到状态">
          <el-select v-model="transForm.toCode" filterable style="width: 100%">
            <el-option v-for="s in wf.statuses" :key="s.code" :label="`${s.code} · ${s.name}`" :value="s.code" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作文案">
          <el-input v-model="transForm.label" maxlength="80" placeholder="例如：下发订单 / 转入设计 / 提交出货审批" />
        </el-form-item>
        <el-form-item label="所需权限">
          <el-select v-model="transForm.permissionKey" filterable style="width: 100%">
            <el-option v-for="a in ACTION_DEFS" :key="a.key" :label="`${a.key} — ${a.title}`" :value="a.key" />
          </el-select>
        </el-form-item>
        <el-form-item label="副作用">
          <el-select v-model="transForm.effect" style="width: 100%">
            <el-option label="仅改状态" value="default" />
            <el-option label="申请出货：清空放行标记" value="ship_request" />
            <el-option label="同意出货：写入放行" value="ship_approve" />
            <el-option label="退回生产：清空放行" value="ship_reject" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="transVisible = false">取消</el-button>
        <el-button type="primary" @click="submitTrans">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ACTION_DEFS } from '@/mock/data'
import { useOrderWorkflowStore } from '@/stores/orderWorkflow'

const wfStore = useOrderWorkflowStore()
const { data: wf } = storeToRefs(wfStore)

const tab = ref('status')

const statusVisible = ref(false)
const statusCodeLocked = ref(false)
const statusForm = reactive(emptyStatus())

function emptyStatus() {
  return {
    id: '',
    code: '',
    name: '',
    sortOrder: 100,
    tagType: 'info',
    isDraft: false,
    isClosed: false,
    countsAsRunning: false,
    workshopPanel: 'none',
    allowsShippingSubmit: false,
    showShipPendingExtra: false,
    showShipReleaseExtra: false,
  }
}

function openStatus(row) {
  if (row) {
    statusCodeLocked.value = true
    Object.assign(statusForm, {
      id: row.id,
      code: row.code,
      name: row.name,
      sortOrder: row.sortOrder,
      tagType: row.tagType,
      isDraft: !!row.isDraft,
      isClosed: !!row.isClosed,
      countsAsRunning: !!row.countsAsRunning,
      workshopPanel: row.workshopPanel || 'none',
      allowsShippingSubmit: !!row.allowsShippingSubmit,
      showShipPendingExtra: !!row.showShipPendingExtra,
      showShipReleaseExtra: !!row.showShipReleaseExtra,
    })
  } else {
    statusCodeLocked.value = false
    const maxS = wf.value.statuses.length ? Math.max(...wf.value.statuses.map((s) => s.sortOrder)) : 0
    Object.assign(statusForm, emptyStatus(), { id: '', sortOrder: maxS + 10 })
  }
  statusVisible.value = true
}

function resetStatusForm() {
  Object.assign(statusForm, emptyStatus())
  statusCodeLocked.value = false
}

function submitStatus() {
  const code = statusForm.code?.trim()
  const name = statusForm.name?.trim() || code
  if (!code) {
    ElMessage.warning('请填写状态编码')
    return
  }
  if (!statusForm.id) {
    if (wf.value.statuses.some((s) => s.code === code)) {
      ElMessage.warning('编码已存在')
      return
    }
  }
  const draftCount =
    wf.value.statuses.filter((s) => s.isDraft && s.id !== statusForm.id).length + (statusForm.isDraft ? 1 : 0)
  if (draftCount === 0) {
    ElMessage.warning('请至少保留一个「草稿」类状态（未下发），否则新建订单无法归类')
    return
  }

  const id = statusForm.id || `st-${Date.now()}`
  wfStore.upsertStatus({
    id,
    code,
    name,
    sortOrder: Number(statusForm.sortOrder) || 0,
    tagType: statusForm.tagType,
    isDraft: !!statusForm.isDraft,
    isClosed: !!statusForm.isClosed,
    countsAsRunning: !!statusForm.countsAsRunning,
    workshopPanel: statusForm.workshopPanel,
    allowsShippingSubmit: !!statusForm.allowsShippingSubmit,
    showShipPendingExtra: !!statusForm.showShipPendingExtra,
    showShipReleaseExtra: !!statusForm.showShipReleaseExtra,
  })
  statusVisible.value = false
  ElMessage.success('已保存状态')
}

async function onRemoveStatus(row) {
  try {
    await ElMessageBox.confirm(`确定删除状态「${row.name}」？`, '提示', { type: 'warning' })
  } catch {
    return
  }
  const r = wfStore.removeStatus(row.id)
  if (!r.ok) ElMessage.warning(r.message)
  else ElMessage.success('已删除')
}

const transVisible = ref(false)
const transForm = reactive(emptyTrans())

function emptyTrans() {
  return {
    id: '',
    fromCode: '',
    toCode: '',
    label: '',
    permissionKey: 'action_mo_workshop_judge',
    effect: 'default',
    sortOrder: 100,
  }
}

function openTrans(row) {
  if (row) {
    Object.assign(transForm, {
      id: row.id,
      fromCode: row.fromCode,
      toCode: row.toCode,
      label: row.label,
      permissionKey: row.permissionKey,
      effect: row.effect || 'default',
      sortOrder: row.sortOrder,
    })
  } else {
    const maxT =
      wf.value.transitions.length > 0 ? Math.max(...wf.value.transitions.map((t) => t.sortOrder)) : 0
    Object.assign(transForm, emptyTrans(), { id: '', sortOrder: maxT + 10, fromCode: wf.value.statuses[0]?.code || '' })
  }
  transVisible.value = true
}

function resetTransForm() {
  Object.assign(transForm, emptyTrans())
}

function submitTrans() {
  if (!transForm.fromCode || !transForm.toCode) {
    ElMessage.warning('请选择从/到状态')
    return
  }
  if (!transForm.label?.trim()) {
    ElMessage.warning('请填写按钮文案')
    return
  }
  if (!transForm.permissionKey) {
    ElMessage.warning('请选择所需权限')
    return
  }
  const codes = new Set(wf.value.statuses.map((s) => s.code))
  if (!codes.has(transForm.fromCode) || !codes.has(transForm.toCode)) {
    ElMessage.warning('从/到状态必须在「订单状态」表中已存在')
    return
  }
  const id = transForm.id || `tr-${Date.now()}`
  wfStore.upsertTransition({
    id,
    fromCode: transForm.fromCode,
    toCode: transForm.toCode,
    label: transForm.label.trim(),
    permissionKey: transForm.permissionKey,
    effect: transForm.effect || 'default',
    sortOrder: Number(transForm.sortOrder) || 0,
  })
  transVisible.value = false
  ElMessage.success('已保存流转')
}

async function onRemoveTrans(row) {
  try {
    await ElMessageBox.confirm('确定删除该流转规则？', '提示', { type: 'warning' })
  } catch {
    return
  }
  wfStore.removeTransition(row.id)
  ElMessage.success('已删除')
}

async function onResetDefaults() {
  try {
    await ElMessageBox.confirm('将恢复内置默认状态与流转，当前自定义配置会丢失。是否继续？', '提示', { type: 'warning' })
  } catch {
    return
  }
  wfStore.resetDefaults()
  ElMessage.success('已恢复默认')
}
</script>

<style scoped>
.nf-page {
  max-width: 1200px;
  margin: 0 auto;
}
.nf-toolbar__title {
  font-weight: 600;
  font-size: 16px;
}
.nf-toolbar__desc {
  margin: 6px 0 0;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
}
.nf-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}
.nf-toolbar__actions {
  flex-shrink: 0;
}
.nf-mb {
  margin-bottom: 12px;
}
.nf-muted {
  margin-left: 8px;
  font-size: 12px;
  color: #9ca3af;
}
</style>
