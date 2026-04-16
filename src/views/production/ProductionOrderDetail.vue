<template>
  <div class="nf-page" v-if="order && canViewOrder">
    <el-page-header @back="$router.push('/production-orders')" content="生产订单详情" class="nf-back" />

    <el-card shadow="never" class="nf-row-mt">
      <div class="nf-order-head">
        <div>
          <h2 class="nf-order-head__title">{{ order.id }}</h2>
          <p class="nf-order-head__sub">{{ order.customer }} · 创建人 {{ order.owner }}</p>
        </div>
        <div class="nf-order-head__tags">
          <el-tag :type="workflowStore.tagTypeFor(order.status)" size="large">{{ orderStatusLabel }}</el-tag>
          <el-tag v-if="order.customerType === '出口'" type="warning" size="large">出口</el-tag>
          <el-tag v-if="statusDef?.showShipPendingExtra" type="warning" size="large">待厂长出货审批</el-tag>
          <el-tag
            v-else-if="statusDef?.showShipReleaseExtra"
            :type="order.shipReleaseApproved ? 'success' : 'info'"
            size="large"
          >
            {{
              order.shipReleaseApproved
                ? `已同意出货${order.shipReleaseBy ? `·${order.shipReleaseBy}` : ''}`
                : '待厂长同意出货'
            }}
          </el-tag>
        </div>
      </div>
      <div class="nf-status-steps">
        <el-steps :active="statusStepIndex" align-center>
          <el-step v-for="s in statusSteps" :key="s.code" :title="s.name || s.code" />
        </el-steps>
      </div>
    </el-card>

    <el-tabs v-model="tab" type="border-card" class="nf-tabs nf-row-mt">
      <el-tab-pane label="主信息" name="main">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="客户/项目">{{ order.customer }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{ order.customerType }}</el-descriptions-item>
          <el-descriptions-item label="下达日期">{{ order.signedAt }}</el-descriptions-item>
          <el-descriptions-item label="要求交期">{{ order.dueDate }}</el-descriptions-item>
          <el-descriptions-item label="创建人">{{ order.owner }}</el-descriptions-item>
          <el-descriptions-item label="分批出货">
            <el-switch
              :model-value="order.allowPartialShip"
              :disabled="!canEditPartialShip"
              @change="onTogglePartialShip"
            />
            <span class="nf-muted">{{ order.allowPartialShip ? '允许' : '不允许' }}</span>
            <span v-if="!canEditPartialShip" class="nf-muted">（仅厂长可调整）</span>
          </el-descriptions-item>
        </el-descriptions>

        <div class="nf-remark-block">
          <div class="nf-remark-block__head">
            <span class="nf-remark-block__title">备注（按时间追加，不覆盖历史）</span>
            <el-button type="primary" link @click="openRemarkDialog">＋ 追加备注</el-button>
          </div>
          <p v-if="!sortedRemarkEntries.length" class="nf-muted nf-remark-empty">暂无备注，可点击「追加备注」。</p>
          <div v-else class="nf-remark-log">
            <div
              v-for="e in sortedRemarkEntries"
              :key="e.id"
              :class="['nf-remark-item', e.priority === 'high' ? 'nf-remark-item--high' : '', e.done ? 'nf-remark-item--done' : '']"
            >
              <div class="nf-remark-meta">
                <span>{{ e.createdAt }} · {{ e.createdBy }}</span>
                <el-tag v-if="e.priority === 'high'" type="danger" size="small" effect="dark" class="nf-remark-prio">
                  高优先级
                </el-tag>
                <el-tag v-if="e.done" type="success" size="small" effect="plain">已完成</el-tag>
                <el-tag v-else type="info" size="small" effect="plain">进行中</el-tag>
                <el-button link type="primary" @click="toggleMainRemarkDone(e)">
                  {{ e.done ? '设为未完成' : '标记完成' }}
                </el-button>
              </div>
              <div class="nf-remark-text">{{ e.text }}</div>
            </div>
          </div>
        </div>

        <el-dialog v-model="remarkDialogVisible" title="追加备注" width="520px" destroy-on-close @closed="resetRemarkForm">
          <el-form label-position="top">
            <el-form-item label="备注内容">
              <el-input
                v-model="remarkForm.text"
                type="textarea"
                :rows="4"
                maxlength="500"
                show-word-limit
                placeholder="输入要追加的内容"
              />
            </el-form-item>
            <el-form-item label="优先级">
              <el-radio-group v-model="remarkForm.priority">
                <el-radio label="normal">普通</el-radio>
                <el-radio label="high">高优先级（列表中以红色突出）</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="记录人">
              <el-input v-model="remarkForm.by" maxlength="20" placeholder="默认当前角色名称" />
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="remarkDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="submitAppendRemark">保存</el-button>
          </template>
        </el-dialog>

        <div class="nf-actions">
          <template v-if="visibleTransitions.length === 1">
            <el-button :type="transitionBtnType(visibleTransitions[0])" @click="runTransition(visibleTransitions[0])">
              {{ transitionDisplayLabel(visibleTransitions[0]) }}
            </el-button>
          </template>
          <template v-else-if="visibleTransitions.length > 1">
            <el-select
              v-model="selectedTransitionId"
              class="nf-transition-select"
              placeholder="选择下一步操作"
              filterable
            >
              <el-option
                v-for="t in visibleTransitions"
                :key="t.id"
                :label="transitionOptionLabel(t)"
                :value="t.id"
              />
            </el-select>
            <el-button :disabled="!selectedTransition" type="primary" @click="runSelectedTransition">确认执行</el-button>
          </template>
          <span v-else class="nf-muted">当前状态下暂无可执行流转</span>
          <el-button v-if="rolesStore.can('purchase')" @click="$router.push('/purchase/requests')">去采购申请</el-button>
        </div>
        <p class="nf-flow-hint">
          <strong>草稿</strong>仅厂长与管理员可见。<strong>厂长下发</strong>后车间主任判读是否需设计；需设计则由设计部完成后进入备货。备货与采购可并行，进入<strong>生产中</strong>后仍可继续采购补料。生产结束后由车间主任<strong>申请出货</strong>，<strong>厂长同意</strong>后状态为待出货，方可到出货页提交。结案仍走<strong>财务应收 → 审批中心</strong>。
        </p>
      </el-tab-pane>

      <el-tab-pane label="订单明细" name="lines">
        <p class="nf-muted nf-mb">
          对齐线下「生产单」列：<strong>单位名称、机型、冷/热、缝包、台数、打孔</strong>。每行备注可多次追加并设优先级；点左侧展开查看历史。
        </p>
        <el-table :data="order.lines" stripe border>
          <el-table-column type="expand" width="44">
            <template #default="{ row }">
              <div class="nf-line-remark-expand">
                <div class="nf-line-remark-expand__head">
                  <span>明细备注（{{ sortedLineRemarks(row).length }} 条）</span>
                  <el-button type="primary" link @click="openLineRemarkDialog(row)">＋ 追加备注</el-button>
                </div>
                <p v-if="!sortedLineRemarks(row).length" class="nf-muted nf-remark-empty">暂无明细备注，可点击「追加备注」。</p>
                <div v-else class="nf-remark-log nf-line-remark-log">
                  <div
                    v-for="e in sortedLineRemarks(row)"
                    :key="e.id"
                    :class="['nf-remark-item', e.priority === 'high' ? 'nf-remark-item--high' : '', e.done ? 'nf-remark-item--done' : '']"
                  >
                    <div class="nf-remark-meta">
                      <span>{{ e.createdAt }} · {{ e.createdBy }}</span>
                      <el-tag v-if="e.priority === 'high'" type="danger" size="small" effect="dark" class="nf-remark-prio">
                        高优先级
                      </el-tag>
                      <el-tag v-if="e.done" type="success" size="small" effect="plain">已完成</el-tag>
                      <el-tag v-else type="info" size="small" effect="plain">进行中</el-tag>
                      <el-button link type="primary" @click="toggleLineRemarkDone(row, e)">
                        {{ e.done ? '设为未完成' : '标记完成' }}
                      </el-button>
                    </div>
                    <div class="nf-remark-text">{{ e.text }}</div>
                  </div>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column type="index" label="#" width="50" />
          <el-table-column prop="unit" label="单位名称" min-width="120" />
          <el-table-column prop="model" label="机型" min-width="180" />
          <el-table-column prop="temp" label="冷/热" width="88" />
          <el-table-column prop="stitch" label="缝包" width="100" />
          <el-table-column prop="qty" label="台数" width="72" align="center" />
          <el-table-column prop="punch" label="打孔" width="88" />
          <el-table-column label="备注摘要" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ lineRemarkSummary(row) }}</template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="出货与财务" name="ship">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-card shadow="never" header="出货">
              <el-descriptions :column="1" border>
                <el-descriptions-item label="订单台数">{{ order.totalQty }}</el-descriptions-item>
                <el-descriptions-item label="已出货台数">{{ order.shippedQty }}</el-descriptions-item>
              </el-descriptions>
              <el-button type="primary" class="nf-mt" @click="$router.push({ path: '/shipping', query: { order: order.id } })">
                创建出货确认
              </el-button>
            </el-card>
          </el-col>
          <el-col :span="12">
            <el-card shadow="never" header="财务">
              <template v-if="rolesStore.canViewOrderFinancials()">
                <el-descriptions :column="1" border>
                  <el-descriptions-item label="合同金额">
                    ¥{{ order.contractAmount.toLocaleString() }}
                  </el-descriptions-item>
                  <el-descriptions-item label="已回款">
                    ¥{{ order.receivedAmount.toLocaleString() }}
                  </el-descriptions-item>
                  <el-descriptions-item label="未回款">
                    ¥{{ (order.contractAmount - order.receivedAmount).toLocaleString() }}
                  </el-descriptions-item>
                  <el-descriptions-item label="本单采购金额（关联采购单合计）">
                    ¥{{ purchaseTotalForOrder.toLocaleString() }}
                  </el-descriptions-item>
                </el-descriptions>
              </template>
              <p v-else class="nf-muted">合同金额、已回款及本单采购金额仅厂长（及管理员）可见。</p>
              <el-button v-if="rolesStore.can('finance')" class="nf-mt" @click="$router.push('/finance/receivables')">
                查看应收列表
              </el-button>
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="lineRemarkDialogVisible"
      title="追加明细备注"
      width="520px"
      destroy-on-close
      @closed="resetLineRemarkForm"
    >
      <el-form label-position="top">
        <el-form-item label="备注内容">
          <el-input
            v-model="lineRemarkForm.text"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-word-limit
            placeholder="输入要追加的内容"
          />
        </el-form-item>
        <el-form-item label="优先级">
          <el-radio-group v-model="lineRemarkForm.priority">
            <el-radio label="normal">普通</el-radio>
            <el-radio label="high">高优先级（列表摘要中标示）</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="记录人">
          <el-input v-model="lineRemarkForm.by" maxlength="20" placeholder="默认当前角色名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="lineRemarkDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitLineRemark">保存</el-button>
      </template>
    </el-dialog>
  </div>
  <div class="nf-page" v-else-if="order && !canViewOrder">
    <el-page-header @back="$router.push('/production-orders')" content="生产订单详情" class="nf-back" />
    <el-alert type="warning" show-icon :closable="false" class="nf-row-mt" title="未下发的订单仅厂长可见" />
    <el-empty description="请切换为「厂长」或「系统管理员」后查看，或返回列表。" />
  </div>
  <el-empty v-else description="未找到该生产订单" />
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { useProductionOrderStore } from '@/stores/productionOrders'
import { usePurchaseOrderStore } from '@/stores/purchaseOrders'
import { useRolesStore } from '@/stores/roles'
import { useOrderWorkflowStore } from '@/stores/orderWorkflow'

const route = useRoute()
const tab = ref('main')
const TAB_NAMES = new Set(['main', 'lines', 'ship'])

watch(
  () => route.params.id,
  () => {
    const q = route.query.tab
    tab.value = typeof q === 'string' && TAB_NAMES.has(q) ? q : 'main'
  },
  { immediate: true },
)

const poStore = useProductionOrderStore()
const purchaseStore = usePurchaseOrderStore()
const rolesStore = useRolesStore()
const workflowStore = useOrderWorkflowStore()
const { orders } = storeToRefs(poStore)

const order = computed(() => orders.value.find((o) => o.id === route.params.id))

const statusDef = computed(() => (order.value ? workflowStore.statusByCode(order.value.status) : null))
const orderStatusLabel = computed(() => {
  if (!order.value) return ''
  return statusDef.value?.name || order.value.status
})
const statusSteps = computed(() => workflowStore.statuses.map((s) => ({ code: s.code, name: s.name || s.code })))
const statusStepIndex = computed(() => {
  if (!order.value) return 0
  const i = statusSteps.value.findIndex((s) => s.code === order.value.status)
  return i >= 0 ? i : 0
})

const visibleTransitions = computed(() => {
  if (!order.value) return []
  return workflowStore.transitionsFrom(order.value.status).filter((t) => rolesStore.can(t.permissionKey))
})
const selectedTransitionId = ref('')
const selectedTransition = computed(() =>
  visibleTransitions.value.find((t) => t.id === selectedTransitionId.value) || null,
)

const purchaseTotalForOrder = computed(() => {
  const o = order.value
  if (!o || !rolesStore.canViewOrderFinancials()) return 0
  return purchaseStore.sumAmountForProductionOrder(o.id)
})

watch(
  () => order.value?.id,
  (id) => {
    if (id) poStore.touchLineStructure(id)
  },
  { immediate: true },
)
watch(
  visibleTransitions,
  (list) => {
    if (!list.length) {
      selectedTransitionId.value = ''
      return
    }
    if (!list.some((t) => t.id === selectedTransitionId.value)) {
      selectedTransitionId.value = list.length === 1 ? list[0].id : ''
    }
  },
  { immediate: true },
)

const canViewOrder = computed(() => {
  const o = order.value
  if (!o) return false
  if (!workflowStore.isDraftStatus(o.status)) return true
  return rolesStore.canViewDraftProductionOrder()
})

const canEditPartialShip = computed(() => rolesStore.can('action_mo_issue'))

const sortedRemarkEntries = computed(() => {
  const o = order.value
  if (!o) return []
  const list = Array.isArray(o.remarkEntries) ? [...o.remarkEntries] : []
  return list.sort((a, b) => {
    const ta = `${a.createdAt || ''}\t${a.id || ''}`
    const tb = `${b.createdAt || ''}\t${b.id || ''}`
    return ta.localeCompare(tb)
  })
})

const remarkDialogVisible = ref(false)
const remarkForm = ref({ text: '', priority: 'normal', by: '' })

const lineRemarkDialogVisible = ref(false)
const lineRemarkTargetLineId = ref('')
const lineRemarkForm = ref({ text: '', priority: 'normal', by: '' })

function openRemarkDialog() {
  remarkForm.value = {
    text: '',
    priority: 'normal',
    by: rolesStore.currentRole?.name || '',
  }
  remarkDialogVisible.value = true
}

function resetRemarkForm() {
  remarkForm.value = { text: '', priority: 'normal', by: '' }
}

function sortedLineRemarks(row) {
  const list = Array.isArray(row?.noteRemarkEntries) ? [...row.noteRemarkEntries] : []
  return list.sort((a, b) => {
    const ta = `${a.createdAt || ''}\t${a.id || ''}`
    const tb = `${b.createdAt || ''}\t${b.id || ''}`
    return ta.localeCompare(tb)
  })
}

function lineRemarkSummary(row) {
  const arr = sortedLineRemarks(row)
  if (!arr.length) return '—'
  const hasHigh = arr.some((e) => e.priority === 'high')
  const last = arr[arr.length - 1]
  const t = last.text || ''
  const short = t.length > 40 ? `${t.slice(0, 40)}…` : t
  return `${hasHigh ? '【含高优先级】' : ''}${short}`
}

function openLineRemarkDialog(row) {
  if (!order.value || !row?.lineId) {
    ElMessage.warning('明细行数据异常，请刷新页面重试')
    return
  }
  lineRemarkTargetLineId.value = row.lineId
  lineRemarkForm.value = {
    text: '',
    priority: 'normal',
    by: rolesStore.currentRole?.name || '',
  }
  lineRemarkDialogVisible.value = true
}

function resetLineRemarkForm() {
  lineRemarkForm.value = { text: '', priority: 'normal', by: '' }
  lineRemarkTargetLineId.value = ''
}

function submitLineRemark() {
  const text = lineRemarkForm.value.text?.trim()
  if (!text) {
    ElMessage.warning('请填写备注内容')
    return
  }
  if (!order.value || !lineRemarkTargetLineId.value) return
  const ok = poStore.appendLineRemark(order.value.id, lineRemarkTargetLineId.value, {
    text,
    priority: lineRemarkForm.value.priority,
    by: lineRemarkForm.value.by?.trim() || rolesStore.currentRole?.name || '—',
  })
  if (!ok) {
    ElMessage.warning('保存失败，请重试')
    return
  }
  lineRemarkDialogVisible.value = false
  ElMessage.success('已追加明细备注')
}

function submitAppendRemark() {
  const text = remarkForm.value.text?.trim()
  if (!text) {
    ElMessage.warning('请填写备注内容')
    return
  }
  if (!order.value) return
  poStore.appendRemark(order.value.id, {
    text,
    priority: remarkForm.value.priority,
    by: remarkForm.value.by?.trim() || rolesStore.currentRole?.name || '—',
  })
  remarkDialogVisible.value = false
  ElMessage.success('已追加备注')
}

function toggleMainRemarkDone(entry) {
  if (!order.value || !entry?.id) return
  const next = !entry.done
  const ok = poStore.toggleRemarkDone(order.value.id, entry.id, next)
  if (!ok) {
    ElMessage.warning('更新备注状态失败，请刷新后重试')
    return
  }
  ElMessage.success(next ? '已标记为完成' : '已恢复为未完成')
}

function toggleLineRemarkDone(row, entry) {
  if (!order.value || !row?.lineId || !entry?.id) return
  const next = !entry.done
  const ok = poStore.toggleLineRemarkDone(order.value.id, row.lineId, entry.id, next)
  if (!ok) {
    ElMessage.warning('更新明细备注状态失败，请刷新后重试')
    return
  }
  ElMessage.success(next ? '已标记为完成' : '已恢复为未完成')
}

function transitionBtnType(t) {
  if (t.effect === 'ship_request') return 'warning'
  if (t.effect === 'ship_approve') return 'success'
  return 'primary'
}

function transitionDisplayLabel(t) {
  const raw = String(t?.label || '').trim()
  if (!raw) return `转为${t?.toCode || '目标状态'}`
  if (raw.startsWith('设为')) return `转为${raw.slice(2)}`
  if (raw.includes('→')) {
    const parts = raw.split('→')
    const action = parts[0]?.trim()
    if (action) return action
    const result = parts[parts.length - 1]?.trim()
    if (result) return `转为${result}`
  }
  return raw
}

function transitionOptionLabel(t) {
  const action = transitionDisplayLabel(t)
  const to = workflowStore.statusByCode(t.toCode)?.name || t.toCode
  return `${action}（结果：${to}）`
}

function runSelectedTransition() {
  if (!selectedTransition.value) {
    ElMessage.warning('请先选择下一步操作')
    return
  }
  runTransition(selectedTransition.value)
}

function runTransition(t) {
  if (!order.value) return
  if (!rolesStore.can(t.permissionKey)) {
    ElMessage.warning('当前角色无权执行此操作')
    return
  }
  const actor = rolesStore.currentRole?.name || ''
  const r = workflowStore.applyTransition(order.value.id, t.id, actor)
  if (!r.ok) {
    ElMessage.warning(r.message || '操作失败')
    return
  }
  const to = workflowStore.statusByCode(t.toCode)?.name || t.toCode
  ElMessage.success(`状态已更新为「${to}」`)
}

function onTogglePartialShip(next) {
  if (!order.value) return
  if (!canEditPartialShip.value) {
    ElMessage.warning('仅厂长可调整是否允许分批出货')
    return
  }
  poStore.setAllowPartialShip(order.value.id, !!next)
  ElMessage.success(`已设置为${next ? '允许' : '不允许'}分批出货`)
}

</script>

<style scoped>
.nf-page {
  max-width: 1100px;
  margin: 0 auto;
}
.nf-back :deep(.el-page-header__content) {
  font-size: 16px;
  font-weight: 600;
}
.nf-row-mt {
  margin-top: 16px;
}
.nf-order-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}
.nf-order-head__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}
.nf-order-head__sub {
  margin: 8px 0 0;
  color: #6b7280;
  font-size: 14px;
}
.nf-order-head__tags {
  display: flex;
  gap: 8px;
}
.nf-status-steps {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.nf-tabs {
  border-radius: var(--nf-radius);
  overflow: hidden;
}
.nf-actions {
  margin-top: 20px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}
.nf-transition-select {
  width: min(420px, 100%);
}
.nf-muted {
  color: #6b7280;
  font-size: 13px;
}
.nf-mb {
  margin-bottom: 12px;
}
.nf-mt {
  margin-top: 12px;
}
.nf-flow-hint {
  margin-top: 12px;
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.5;
}
.nf-remark-block {
  margin-top: 16px;
  padding: 12px 0 0;
  border-top: 1px solid var(--el-border-color-lighter);
}
.nf-remark-block__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.nf-remark-block__title {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}
.nf-remark-empty {
  margin: 0;
}
.nf-remark-log {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  overflow: hidden;
}
.nf-remark-item {
  padding: 10px 12px 10px 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: #fafafa;
}
.nf-remark-item:last-child {
  border-bottom: none;
}
.nf-remark-item--done {
  background: #f9fafb;
  border-left: 4px solid #10b981;
  padding-left: 10px;
}
.nf-remark-item--high {
  color: #b91c1c;
  background: #fef2f2;
  border-left: 4px solid #dc2626;
  padding-left: 10px;
}
.nf-remark-item--done .nf-remark-text {
  color: #6b7280;
  text-decoration: line-through;
}
.nf-remark-item--high .nf-remark-meta {
  color: #991b1b;
}
.nf-remark-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 6px;
}
.nf-remark-prio {
  margin-left: 0;
}
.nf-remark-text {
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}
.nf-line-remark-expand {
  padding: 4px 8px 12px 36px;
  max-width: 920px;
}
.nf-line-remark-expand__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}
.nf-line-remark-log {
  margin-top: 0;
}
</style>
