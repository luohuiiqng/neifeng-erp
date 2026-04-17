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

        <el-card v-if="showShipApprovalPanel" shadow="never" class="nf-ship-approve-panel">
          <template #header>
            <span class="nf-ship-approve-panel__title">本次出货审批 · 决策参考</span>
          </template>
          <el-alert
            v-if="rolesStore.canViewOrderFinancials()"
            type="warning"
            show-icon
            :closable="false"
            class="nf-ship-finance-alert"
          >
            <template #title>
              <span class="nf-ship-finance-alert__title">回款核对（同意出货前请重点确认）</span>
            </template>
            <p class="nf-ship-finance-alert__body">{{ shipApproveFinanceLine }}</p>
          </el-alert>
          <p v-else class="nf-muted nf-ship-finance-alert nf-ship-finance-alert--plain">
            合同/回款金额仅厂长（及管理员）可见；同意出货前请向财务确认未结清款项。
          </p>
          <p class="nf-ship-approve-panel__hint">
            以下为车间<strong>提交出货审批时</strong>在<strong>订单明细</strong>各条上填写的本批计划（若有）。同意放行后，出货确认页<strong>须与各条明细的本批台数一致</strong>。
          </p>
          <el-descriptions :column="3" border size="small" class="nf-ship-approve-panel__meta">
            <el-descriptions-item label="出货目标/订单总台数">{{ order.totalQty }}</el-descriptions-item>
            <el-descriptions-item label="已出（累计）">{{ order.shippedQty ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="待出（全单）">{{ orderShipRemainingHeader }} 台</el-descriptions-item>
            <el-descriptions-item label="分批策略">{{ order.allowPartialShip ? '允许分批出货' : '仅整单出货' }}</el-descriptions-item>
            <el-descriptions-item label="本批申请台数">
              <strong v-if="pendingPlanBatchQty">{{ pendingPlanBatchQty }} 台</strong>
              <span v-else class="nf-warn-text">未记录（旧数据或异常）</span>
            </el-descriptions-item>
            <el-descriptions-item label="要求交期">{{ order.dueDate || '—' }}</el-descriptions-item>
          </el-descriptions>
          <el-table v-if="shipPlanTableRows.length" :data="shipPlanTableRows" border size="small" class="nf-mt">
            <el-table-column type="index" label="#" width="44" align="center" />
            <el-table-column prop="unit" label="单位名称" min-width="110" show-overflow-tooltip />
            <el-table-column prop="model" label="机型" min-width="140" show-overflow-tooltip />
            <el-table-column prop="contractQty" label="合同台数" width="88" align="center" />
            <el-table-column prop="lineShipped" label="明细已出" width="88" align="center" />
            <el-table-column prop="lineRemaining" label="明细待出" width="88" align="center" />
            <el-table-column prop="planQty" label="本批申请出货" width="120" align="center">
              <template #default="{ row }">
                <el-tag type="warning" effect="plain">{{ row.planQty }} 台</el-tag>
              </template>
            </el-table-column>
          </el-table>
          <el-alert
            v-else
            type="warning"
            show-icon
            :closable="false"
            class="nf-mt"
            title="本单暂无按订单明细分摊的本批计划（例如系统升级前提交的审批）。请打开「订单明细」并结合下方申请备注综合判断；必要时可驳回并要求车间重新提交。"
          />
        </el-card>

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
          <el-tooltip
            v-for="t in blockedTransitions"
            :key="`blocked-${t.id}`"
            :content="permissionTip(t.permissionKey)"
            placement="top"
          >
            <span>
              <el-button disabled>{{ transitionDisplayLabel(t) }}</el-button>
            </span>
          </el-tooltip>
          <el-tooltip :disabled="rolesStore.can('purchase')" :content="permissionTip('purchase')" placement="top">
            <span>
              <el-button :disabled="!rolesStore.can('purchase')" @click="$router.push('/purchase/requests')">去采购申请</el-button>
            </span>
          </el-tooltip>
        </div>
        <p class="nf-flow-hint">
          <strong>草稿</strong>仅厂长与管理员可见。<strong>厂长下发</strong>后车间主任判读是否需设计；需设计则由设计部完成后进入备货。备货与采购可并行，进入<strong>生产中</strong>后仍可继续采购补料。生产结束后由车间主任<strong>申请出货</strong>（弹窗确认并可填申请说明）；<strong>厂长同意</strong>出货审批后状态为<strong>待出货</strong>，方可到出货页登记；<strong>驳回</strong>须填原因并记入主备注（高优先级）。<strong>登记满台数后自动为「已出货」</strong>；<strong>回款结清</strong>后由具备权限者在<strong>财务应收</strong>点「申请结案」，才会在<strong>审批中心</strong>出现「结案审批」待办（厂长默认可审批）。「出货与财务」页含结案说明与快捷入口。
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
              <template v-if="rolesStore.canViewOrderFinancials()">
                <div v-if="!receiveAmountLocked" class="nf-received-row nf-mt">
                  <span class="nf-received-row__label">已登记回款</span>
                  <el-input-number
                    v-model="receivedDraft"
                    :min="0"
                    :max="order.contractAmount"
                    :step="1000"
                    controls-position="right"
                    class="nf-received-row__input"
                  />
                  <el-button type="primary" size="small" @click="saveReceivedAmount">保存</el-button>
                  <span class="nf-muted">未结案前可改；结案后锁定。</span>
                </div>
                <p v-else class="nf-muted nf-mt">
                  本单已<strong>结案</strong>，<strong>已回款金额已锁定</strong>，不可再改。
                </p>
              </template>
              <el-button v-if="rolesStore.can('finance')" class="nf-mt" @click="$router.push('/finance/receivables')">
                查看应收列表
              </el-button>
            </el-card>
          </el-col>
        </el-row>
        <el-card shadow="never" header="结案" class="nf-row-mt nf-close-card">
          <template v-if="workflowStore.isClosedStatus(order.status)">
            <el-tag type="success" size="large">已结案</el-tag>
          </template>
          <template v-else>
            <p class="nf-muted nf-close-card__p">
              结案<strong>不会</strong>在出货完成后自动出现：须先满足<strong>全部出货 + 生产状态为「已出货」+ 回款结清</strong>，再由具备「申请结案」权限的角色在<strong>财务应收</strong>点击「申请结案」，才会在<strong>审批中心</strong>生成「结案审批」待办；厂长在审批中心「处理」即可同意或退回。
            </p>
            <el-descriptions v-if="rolesStore.canViewOrderFinancials()" :column="2" border size="small" class="nf-mt">
              <el-descriptions-item label="未回款">
                ¥{{ receivableOpenForOrder.toLocaleString() }}
                <span v-if="receivableOpenForOrder > 0" class="nf-warn-text">（须为 0 方可申请结案）</span>
              </el-descriptions-item>
              <el-descriptions-item label="结案审批待办">
                <template v-if="pendingCloseApprovalId">
                  <router-link :to="`/approval/${pendingCloseApprovalId}`" class="nf-link">去审批中心处理</router-link>
                </template>
                <span v-else class="nf-muted">暂无</span>
              </el-descriptions-item>
            </el-descriptions>
            <p v-else class="nf-muted nf-mt">未回款与结案待办明细仅厂长（及管理员）可见；请打开「财务应收」或联系厂长。</p>
            <div class="nf-close-card__actions nf-mt">
              <el-button type="primary" @click="$router.push('/finance/receivables')">打开财务应收</el-button>
              <el-button v-if="pendingCloseApprovalId" type="success" @click="$router.push(`/approval/${pendingCloseApprovalId}`)">
                处理结案审批
              </el-button>
              <el-tooltip v-else :disabled="closeApplyOnDetailEnabled" :content="closeApplyOnDetailTooltip" placement="top">
                <span>
                  <el-button type="success" :disabled="!closeApplyOnDetailEnabled" @click="submitCloseCaseFromDetail">
                    申请结案
                  </el-button>
                </span>
              </el-tooltip>
              <el-button @click="$router.push('/approval')">审批中心</el-button>
            </div>
          </template>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="shipRequestDialogVisible" title="提交出货审批" width="720px" destroy-on-close @closed="resetShipRequestForm">
      <template v-if="order && pendingTransition">
        <el-alert type="info" show-icon :closable="false" class="nf-dialog-alert">
          提交后本单将进入<strong>待出货审批</strong>。请在下表<strong>各条订单明细</strong>上填写本批拟出<strong>台数</strong>，出货确认页将<strong>须与此一致</strong>。厂长同意放行后，车间在「出货确认」按该明细执行。
        </el-alert>
        <el-descriptions :column="1" border class="nf-mt">
          <el-descriptions-item label="生产单号">{{ order.id }}</el-descriptions-item>
          <el-descriptions-item label="客户">{{ order.customer }}</el-descriptions-item>
          <el-descriptions-item label="订单台数">
            <template v-if="order.allowPartialShip">
              <div class="nf-ship-req-qty">
                <el-input-number v-model="shipRequestTotalDraft" :min="shipRequestMinTotal" :max="99999" />
                <span class="nf-muted">
                  允许分批：可调整出货目标；须 ≥ 已出货（{{ order.shippedQty || 0 }}）；明细合计 {{ shipRequestLineSum }} 台
                </span>
              </div>
            </template>
            <template v-else>{{ order.totalQty }}</template>
          </el-descriptions-item>
          <el-descriptions-item label="当前状态">{{ orderStatusLabel }}</el-descriptions-item>
        </el-descriptions>
        <div class="nf-ship-line-plan nf-mt">
          <div class="nf-h4-like">本批计划出货（按订单明细）</div>
          <el-table v-if="(order.lines || []).length" :data="order.lines" border size="small" max-height="280">
            <el-table-column type="index" label="#" width="44" align="center" />
            <el-table-column prop="unit" label="单位" min-width="100" show-overflow-tooltip />
            <el-table-column prop="model" label="机型" min-width="120" show-overflow-tooltip />
            <el-table-column label="合同" width="72" align="center">
              <template #default="{ row }">{{ row.qty }}</template>
            </el-table-column>
            <el-table-column label="明细已出" width="86" align="center">
              <template #default="{ row }">{{ row.shippedQty ?? 0 }}</template>
            </el-table-column>
            <el-table-column label="明细待出" width="86" align="center">
              <template #default="{ row }">{{ lineRemainingShipRequest(row) }}</template>
            </el-table-column>
            <el-table-column label="本批计划" min-width="130" align="center">
              <template #default="{ row }">
                <el-input-number
                  :model-value="shipRequestLineDraft[row.lineId] ?? 0"
                  :min="0"
                  :max="lineRemainingShipRequest(row)"
                  size="small"
                  controls-position="right"
                  @update:model-value="(v) => (shipRequestLineDraft[row.lineId] = v)"
                />
              </template>
            </el-table-column>
          </el-table>
          <p v-else class="nf-muted">无订单明细，无法按明细填写本批计划。</p>
          <p class="nf-muted nf-mt">
            本批计划合计：<strong>{{ shipRequestBatchSum }}</strong> 台（须 ≥ 1；整单出货时须等于全部待出台数）。
          </p>
        </div>
        <el-form label-position="top" class="nf-mt">
          <el-form-item label="申请说明（选填，将追加到主备注）">
            <el-input
              v-model="shipRequestForm.note"
              type="textarea"
              :rows="3"
              maxlength="500"
              show-word-limit
              placeholder="如：生产已齐套、客户催货、计划发货日期等"
            />
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="shipRequestDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmShipRequestDialog">确认提交审批</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="rejectDialogVisible" title="出货审批驳回" width="520px" destroy-on-close @closed="resetRejectForm">
      <el-alert type="warning" show-icon :closable="false" class="nf-dialog-alert">
        驳回后订单将退回<strong>生产中</strong>，并清空出货放行状态。请填写驳回原因，将<strong>自动追加</strong>到本单主备注且标记为<strong>高优先级</strong>。
      </el-alert>
      <el-form label-position="top" class="nf-mt">
        <el-form-item label="驳回原因" required>
          <el-input
            v-model="rejectReasonForm.text"
            type="textarea"
            :rows="4"
            maxlength="1000"
            show-word-limit
            placeholder="请说明驳回原因，便于车间整改后再次申请"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="confirmRejectDialog">确认驳回</el-button>
      </template>
    </el-dialog>

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
import { ref, reactive, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useProductionOrderStore } from '@/stores/productionOrders'
import { usePurchaseOrderStore } from '@/stores/purchaseOrders'
import { useRolesStore } from '@/stores/roles'
import { useOrderWorkflowStore } from '@/stores/orderWorkflow'
import { useApprovalsStore } from '@/stores/approvals'
import { permissionTip } from '@/utils/permissionMeta'
import {
  isProductionOrderFullyShipped,
  isProductionOrderReadyForCaseClose,
  isProductionOrderReceivedAmountLocked,
} from '@/utils/orderCloseRules'

const route = useRoute()
const router = useRouter()
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
const approvalsStore = useApprovalsStore()
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

const allTransitions = computed(() => {
  if (!order.value) return []
  return workflowStore.transitionsFrom(order.value.status)
})
const visibleTransitions = computed(() => allTransitions.value.filter((t) => rolesStore.can(t.permissionKey)))
const blockedTransitions = computed(() => allTransitions.value.filter((t) => !rolesStore.can(t.permissionKey)))
const selectedTransitionId = ref('')
const selectedTransition = computed(() =>
  visibleTransitions.value.find((t) => t.id === selectedTransitionId.value) || null,
)

const pendingTransition = ref(null)
const rejectDialogVisible = ref(false)
const rejectReasonForm = reactive({ text: '' })
const shipRequestDialogVisible = ref(false)
const shipRequestForm = reactive({ note: '' })
const shipRequestTotalDraft = ref(1)
const shipRequestLineSum = computed(() => {
  const o = order.value
  if (!o?.lines) return 0
  return o.lines.reduce((s, l) => s + (Number(l.qty) || 0), 0)
})
const shipRequestMinTotal = computed(() => Math.max(1, Number(order.value?.shippedQty) || 0))

const showShipApprovalPanel = computed(() => !!statusDef.value?.showShipPendingExtra)
const orderShipRemainingHeader = computed(() => {
  const o = order.value
  if (!o) return 0
  return Math.max(0, (Number(o.totalQty) || 0) - (Number(o.shippedQty) || 0))
})
const pendingPlanBatchQty = computed(() => Math.max(0, Number(order.value?.pendingShipmentPlan?.batchQty) || 0))
const shipPlanTableRows = computed(() => {
  const o = order.value
  const alloc = o?.pendingShipmentPlan?.lineAllocations
  if (!o || !Array.isArray(alloc) || !alloc.length) return []
  return alloc.map((a) => {
    const line = (o.lines || []).find((l) => l.lineId === a.lineId)
    const qty = Math.max(0, Number(line?.qty) || 0)
    const sh = Math.max(0, Number(line?.shippedQty) || 0)
    return {
      lineId: a.lineId,
      planQty: Math.max(0, Number(a.qty) || 0),
      unit: line?.unit ?? '—',
      model: line?.model ?? '—',
      contractQty: qty,
      lineShipped: sh,
      lineRemaining: Math.max(0, qty - sh),
    }
  })
})
const shipRequestLineDraft = reactive({})
const shipRequestBatchSum = computed(() => {
  const o = order.value
  if (!o?.lines) return 0
  return o.lines.reduce((s, l) => s + Math.max(0, Math.floor(Number(shipRequestLineDraft[l.lineId]) || 0)), 0)
})

function lineRemainingShipRequest(row) {
  const q = Math.max(0, Number(row?.qty) || 0)
  const sh = Math.max(0, Number(row?.shippedQty) || 0)
  return Math.max(0, q - sh)
}

function initShipRequestLineDraft() {
  const o = order.value
  if (!o?.lines?.length) return
  Object.keys(shipRequestLineDraft).forEach((k) => delete shipRequestLineDraft[k])
  for (const line of o.lines) {
    if (o.allowPartialShip) {
      shipRequestLineDraft[line.lineId] = 0
    } else {
      shipRequestLineDraft[line.lineId] = Math.max(0, (Number(line.qty) || 0) - (Number(line.shippedQty) || 0))
    }
  }
}

const purchaseTotalForOrder = computed(() => {
  const o = order.value
  if (!o || !rolesStore.canViewOrderFinancials()) return 0
  return purchaseStore.sumAmountForProductionOrder(o.id)
})

const receivableOpenForOrder = computed(() => {
  const o = order.value
  if (!o) return 0
  return Math.max(0, (Number(o.contractAmount) || 0) - (Number(o.receivedAmount) || 0))
})

const receiveAmountLocked = computed(() => isProductionOrderReceivedAmountLocked(order.value))

const shipApproveFinanceLine = computed(() => {
  const o = order.value
  if (!o) return ''
  const c = Math.max(0, Number(o.contractAmount) || 0)
  const r = Math.max(0, Number(o.receivedAmount) || 0)
  const open = Math.max(0, c - r)
  if (open > 0) {
    return `合同 ¥${c.toLocaleString()}，已回款 ¥${r.toLocaleString()}，尚有未结清 ¥${open.toLocaleString()}。同意出货仅放行车间按本批计划发运；回款与结案须后续在「财务应收」跟进（须收齐后方可申请结案）。`
  }
  return `合同 ¥${c.toLocaleString()}，已回款 ¥${r.toLocaleString()}，未结清 ¥0（已全部结清）。`
})

const receivedDraft = ref(0)
watch(
  () => [order.value?.id, order.value?.receivedAmount],
  () => {
    const o = order.value
    receivedDraft.value = o ? Math.max(0, Number(o.receivedAmount) || 0) : 0
  },
  { immediate: true },
)

const pendingCloseApprovalId = computed(() => {
  const o = order.value
  if (!o || workflowStore.isClosedStatus(o.status)) return ''
  const hit = approvalsStore.items.find((a) => a.type === '结案审批' && a.ref === o.id && a.status === '待审批')
  return hit?.id || ''
})

const closeApplyOnDetailEnabled = computed(() => {
  const o = order.value
  if (!o || workflowStore.isClosedStatus(o.status)) return false
  if (pendingCloseApprovalId.value) return false
  if (!rolesStore.can('action_finance_apply_close')) return false
  if (!isProductionOrderReadyForCaseClose(o)) return false
  if (receivableOpenForOrder.value > 0) return false
  return true
})

const closeApplyOnDetailTooltip = computed(() => {
  const o = order.value
  if (!o) return ''
  if (workflowStore.isClosedStatus(o.status)) return '已结案'
  if (pendingCloseApprovalId.value) return '已有待审批的结案申请，请使用「处理结案审批」'
  if (!rolesStore.can('action_finance_apply_close')) return permissionTip('action_finance_apply_close')
  if (!isProductionOrderFullyShipped(o)) {
    return `须全部出货（当前已出 ${o.shippedQty ?? 0} / ${o.totalQty ?? 0} 台）`
  }
  if (String(o.status || '').trim() !== '已出货') {
    return `须生产状态为「已出货」（当前为「${o.status || '—'}」）`
  }
  if (receivableOpenForOrder.value > 0) {
    return `须回款结清；当前未收 ¥${receivableOpenForOrder.value.toLocaleString()}`
  }
  return '将生成结案审批待办并跳转审批中心'
})

function closeCaseNowTimeStr() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function saveReceivedAmount() {
  if (!order.value || receiveAmountLocked.value) return
  const r = poStore.setOrderReceivedAmount(order.value.id, receivedDraft.value)
  if (!r?.ok) {
    ElMessage.warning(r?.message || '保存失败')
    return
  }
  ElMessage.success('已更新已回款')
}

function submitCloseCaseFromDetail() {
  const o = order.value
  if (!o || !closeApplyOnDetailEnabled.value) return
  if (approvalsStore.hasPendingTypeRef('结案审批', o.id)) {
    ElMessage.warning('该订单已有待审批的结案申请')
    return
  }
  if (receivableOpenForOrder.value > 0) {
    ElMessage.warning(`须回款结清后方可申请结案（当前未收 ¥${receivableOpenForOrder.value.toLocaleString()}）`)
    return
  }
  if (!isProductionOrderReadyForCaseClose(o)) {
    ElMessage.warning('当前不满足申请结案条件')
    return
  }
  approvalsStore.addPending({
    id: `AP-CLOSE-${o.id}-${Date.now()}`,
    type: '结案审批',
    ref: o.id,
    customer: o.customer || '—',
    submitter: rolesStore.currentRole?.name || '—',
    time: closeCaseNowTimeStr(),
  })
  ElMessage.success('已提交结案审批，请到审批中心处理')
  router.push('/approval')
}

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

function buildShipApproveConfirmMessage(toName) {
  const o = order.value
  if (!o) return `确认同意本次出货审批？\n目标状态：「${toName}」。`
  const rem = Math.max(0, (Number(o.totalQty) || 0) - (Number(o.shippedQty) || 0))
  const plan = o.pendingShipmentPlan
  const lines = []
  lines.push(`订单「${o.id}」将进入「${toName}」。`)
  lines.push('')
  lines.push(`客户：${o.customer}`)
  lines.push('')
  lines.push('【回款（请重点核对）】')
  if (rolesStore.canViewOrderFinancials()) {
    const c = Math.max(0, Number(o.contractAmount) || 0)
    const r = Math.max(0, Number(o.receivedAmount) || 0)
    const open = Math.max(0, c - r)
    lines.push(`合同 ¥${c.toLocaleString()}，已回款 ¥${r.toLocaleString()}，未结清 ¥${open.toLocaleString()}。`)
    if (open > 0) {
      lines.push('本单仍有未结清款项；同意出货后车间可发运，不改变回款义务。')
    } else {
      lines.push('本单未结清款项为 0（已全部结清）。')
    }
  } else {
    lines.push('（合同/回款明细仅厂长可见，同意前请向财务确认未结清金额。）')
  }
  lines.push('')
  lines.push(
    `出货目标/订单总台数：${o.totalQty}，已出：${o.shippedQty ?? 0}，全单待出：${rem} 台；分批：${o.allowPartialShip ? '允许' : '不允许'}。`,
  )
  lines.push('')
  if (plan?.lineAllocations?.length) {
    lines.push(`本批申请合计：${plan.batchQty} 台，按明细：`)
    for (const a of plan.lineAllocations) {
      const line = (o.lines || []).find((l) => l.lineId === a.lineId)
      const label = line ? `${line.unit}·${line.model}` : a.lineId
      lines.push(`  · ${label}：${a.qty} 台`)
    }
  } else {
    lines.push('未找到按明细分摊的本批计划（可能为旧数据），请到主信息「本次出货审批·决策参考」或「订单明细」核对后再操作。')
  }
  lines.push('')
  lines.push('确认同意本次出货审批并记录同意放行？')
  return lines.join('\n')
}

function runSelectedTransition() {
  if (!selectedTransition.value) {
    ElMessage.warning('请先选择下一步操作')
    return
  }
  runTransition(selectedTransition.value)
}

function doApplyTransition(t) {
  if (!order.value || !t) return false
  const actor = rolesStore.currentRole?.name || ''
  const r = workflowStore.applyTransition(order.value.id, t.id, actor)
  if (!r.ok) {
    ElMessage.warning(r.message || '操作失败')
    return false
  }
  const to = workflowStore.statusByCode(t.toCode)?.name || t.toCode
  ElMessage.success(`状态已更新为「${to}」`)
  return true
}

function runTransition(t) {
  if (!order.value || !t) return
  if (!rolesStore.can(t.permissionKey)) {
    ElMessage.warning(permissionTip(t.permissionKey))
    return
  }
  if (t.effect === 'ship_reject') {
    pendingTransition.value = t
    rejectReasonForm.text = ''
    rejectDialogVisible.value = true
    return
  }
  if (t.effect === 'ship_request') {
    pendingTransition.value = t
    shipRequestForm.note = ''
    const o = order.value
    if (o?.id) {
      poStore.touchLineStructure(o.id)
      initShipRequestLineDraft()
    }
    if (o?.allowPartialShip) {
      const header = Math.max(0, Number(o.totalQty) || 0)
      const shipped = Math.max(0, Number(o.shippedQty) || 0)
      const lineSum = (o.lines || []).reduce((s, l) => s + (Number(l.qty) || 0), 0)
      shipRequestTotalDraft.value = Math.max(header, lineSum, shipped, 1)
    }
    shipRequestDialogVisible.value = true
    return
  }
  if (t.effect === 'ship_approve') {
    const toName = workflowStore.statusByCode(t.toCode)?.name || t.toCode
    ElMessageBox.confirm(buildShipApproveConfirmMessage(toName), '确认出货审批', {
      type: 'warning',
      width: 520,
      confirmButtonText: '同意',
      cancelButtonText: '取消',
    })
      .then(() => doApplyTransition(t))
      .catch(() => {})
    return
  }
  const toName = workflowStore.statusByCode(t.toCode)?.name || t.toCode
  ElMessageBox.confirm(
    `确认执行「${transitionDisplayLabel(t)}」？\n结果状态：「${toName}」。`,
    '状态流转',
    { type: 'warning', confirmButtonText: '确认', cancelButtonText: '取消' },
  )
    .then(() => doApplyTransition(t))
    .catch(() => {})
}

function resetRejectForm() {
  rejectReasonForm.text = ''
  pendingTransition.value = null
}

function resetShipRequestForm() {
  shipRequestForm.note = ''
  Object.keys(shipRequestLineDraft).forEach((k) => delete shipRequestLineDraft[k])
  pendingTransition.value = null
}

function confirmRejectDialog() {
  const text = rejectReasonForm.text.trim()
  if (!text) {
    ElMessage.warning('请填写驳回原因')
    return
  }
  const t = pendingTransition.value
  if (!t || !order.value) {
    rejectDialogVisible.value = false
    return
  }
  if (!doApplyTransition(t)) return
  poStore.clearPendingShipmentPlan(order.value.id)
  const actor = rolesStore.currentRole?.name || '—'
  poStore.appendRemark(order.value.id, {
    text: `[出货审批驳回] ${text}`,
    priority: 'high',
    by: actor,
  })
  rejectDialogVisible.value = false
  pendingTransition.value = null
}

function confirmShipRequestDialog() {
  const t = pendingTransition.value
  if (!t || !order.value) {
    shipRequestDialogVisible.value = false
    return
  }
  poStore.touchLineStructure(order.value.id)
  const o = order.value
  const lineAllocations = (o.lines || [])
    .map((l) => ({
      lineId: l.lineId,
      qty: Math.max(0, Math.floor(Number(shipRequestLineDraft[l.lineId]) || 0)),
    }))
    .filter((x) => x.qty > 0)
  if (o.allowPartialShip) {
    const sync = poStore.setShippableTotalQty(o.id, shipRequestTotalDraft.value)
    if (!sync?.ok) {
      ElMessage.warning(sync?.message || '出货目标台数无效')
      return
    }
  }
  const planR = poStore.setPendingShipmentPlan(o.id, { lineAllocations })
  if (!planR?.ok) {
    ElMessage.warning(planR?.message || '本批出货计划无效')
    return
  }
  if (!doApplyTransition(t)) {
    poStore.clearPendingShipmentPlan(o.id)
    return
  }
  const note = shipRequestForm.note.trim()
  const actor = rolesStore.currentRole?.name || '—'
  if (note) {
    poStore.appendRemark(order.value.id, {
      text: `[提交出货审批] ${note}`,
      priority: 'normal',
      by: actor,
    })
  }
  shipRequestDialogVisible.value = false
  pendingTransition.value = null
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
.nf-dialog-alert {
  margin-bottom: 0;
}
.nf-ship-req-qty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.nf-h4-like {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 8px;
  color: #374151;
}
.nf-ship-line-plan :deep(.el-input-number) {
  width: 112px;
}
.nf-close-card__p {
  margin: 0;
  line-height: 1.6;
}
.nf-close-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.nf-ship-approve-panel {
  margin-top: 16px;
  border: 1px solid var(--el-color-warning-light-5);
  background: linear-gradient(180deg, var(--el-color-warning-light-9) 0%, #fff 48%);
}
.nf-ship-approve-panel__title {
  font-weight: 600;
  color: #b45309;
}
.nf-ship-finance-alert {
  margin-bottom: 12px;
}
.nf-ship-finance-alert__title {
  font-weight: 700;
}
.nf-ship-finance-alert__body {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.55;
  color: #57534e;
}
.nf-ship-finance-alert--plain {
  margin-bottom: 12px;
  font-size: 13px;
}
.nf-ship-approve-panel__hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: #57534e;
  line-height: 1.55;
}
.nf-received-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.nf-received-row__label {
  font-size: 13px;
  color: #374151;
}
.nf-received-row__input {
  width: 200px;
}
.nf-ship-approve-panel__meta {
  margin-top: 0;
}
.nf-warn-text {
  color: #c2410c;
  font-size: 13px;
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
