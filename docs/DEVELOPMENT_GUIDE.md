# 内丰 ERP 开发指南

本指南面向后续接手开发人员，目标是回答 5 类问题：

- 现有系统有哪些模块、各自负责什么
- 如何新增一个模块/页面
- 如何新增操作权限
- 如何接入审批流（提交、审核、回写）
- 如何控制“页面可见 / 内容可见 / 操作可执行”

---

## 1. 技术栈与运行方式

- 前端框架：Vue 3（`<script setup>`）
- 构建工具：Vite
- 状态管理：Pinia
- UI 组件库：Element Plus
- 路由：Vue Router
- 数据存储：浏览器 `localStorage`（演示环境）

常用命令：

```bash
npm install
npm run dev
npm run build
```

---

## 2. 关键目录结构

```text
src/
  layouts/                # 主布局（侧栏菜单、头部）
  router/                 # 路由定义与前置权限守卫
  stores/                 # Pinia 数据域（订单、采购、审批、角色等）
  views/                  # 页面
    production/           # 生产模块
    purchase/             # 采购模块
    warehouse/            # 仓库模块
    suppliers/            # 供应商模块
    system/               # 系统管理模块
  mock/data.js            # 菜单权限、操作权限定义、种子数据
  utils/
    permissionMeta.js     # 权限 key -> 展示文案映射
    approvalPermission.js # 审批类型 -> 权限 key 映射
```

---

## 3. 模块总览

### 3.1 工作台

- 页面：`src/views/Dashboard.vue`
- 作用：跨模块统计、待办与提示，按角色展示不同视角

### 3.2 生产模块

- 页面：
  - `src/views/production/ProductionOrderList.vue`
  - `src/views/production/NewProductionOrder.vue`
  - `src/views/production/ProductionOrderDetail.vue`
- Store：`src/stores/productionOrders.js`
- 关键能力：
  - 生产单新增、状态推进、备注/明细备注
  - 出货放行与出货登记（含 `shipments` 历史）

### 3.3 订单状态流转配置（管理员）

- 页面：`src/views/system/OrderWorkflowSettings.vue`
- Store：`src/stores/orderWorkflow.js`
- 关键能力：
  - 配置状态（tag、是否草稿、是否可出货等）
  - 配置状态流转与权限 key、流转副作用（如出货审批）

### 3.4 采购模块

- 页面：
  - `src/views/purchase/PurchaseRequestList.vue`
  - `src/views/purchase/PurchaseRequestDetail.vue`
  - `src/views/purchase/PurchaseOrderDetail.vue`
- Store：
  - `src/stores/purchaseRequests.js`
  - `src/stores/purchaseOrders.js`
- 关键能力：
  - 采购申请（PR）创建、提交审批、物料强关联
  - 采购订单（PO）创建、到货、财务审核、执行状态控制

### 3.5 仓库模块

- 页面：`src/views/warehouse/WarehouseInventory.vue`
- Store：`src/stores/warehouse.js`
- 关键能力：物料主数据、入库/出库/盘点流水

### 3.6 供应商模块

- 页面：`src/views/suppliers/SupplierManagement.vue`
- Store：`src/stores/suppliers.js`
- 关键能力：供应商主数据、绩效指标（逾期率/评级）

### 3.7 出货模块

- 页面：`src/views/Shipping.vue`
- Store：`src/stores/productionOrders.js`（复用）
- 关键能力：
  - 出货条件检查（状态、审批、分批策略）
  - 本次出货登记
  - 历史出货记录与批次打印

### 3.8 财务模块

- 页面：`src/views/FinanceReceivable.vue`
- Store：`productionOrders / purchaseOrders / approvals`
- 关键能力：
  - 应收/应付视图
  - 结案申请、采购财务审核关联

### 3.9 审批中心

- 页面：
  - `src/views/ApprovalList.vue`
  - `src/views/ApprovalDetail.vue`
- Store：`src/stores/approvals.js`
- 关键能力：
  - 待审批列表
  - 按审批类型执行通过/退回并回写业务数据

### 3.10 系统管理

- 页面：
  - `src/views/system/RoleManagement.vue`
  - `src/views/system/UserManagement.vue`
- Store：
  - `src/stores/roles.js`
  - `src/stores/users.js`
- 关键能力：账号、角色、权限分配与登录态

---

## 4. 权限模型（核心）

系统有三层权限控制：

1. 页面可见（菜单+路由）
2. 内容可见（金额、草稿等敏感内容）
3. 操作可执行（按钮动作、状态流转、提交流程）

### 4.1 页面可见（菜单权限）

- 权限定义：`src/mock/data.js` 的 `MENU_DEFS`
- 路由绑定：`src/router/index.js` 的 `meta.perm`
- 菜单渲染：`src/layouts/MainLayout.vue` 中 `visibleMenus`
- 路由拦截：`router.beforeEach` 里 `rolesStore.can(perm)`

结论：**页面访问权限 = `MENU_DEFS.key` + `route.meta.perm` + `rolesStore.can()`**

### 4.2 内容可见（内容权限）

典型 key（定义在 `ACTION_DEFS`）：

- `perm_view_draft_order`：是否能看草稿单
- `perm_view_order_financials`：是否能看金额/回款/采购金额

实现方式（推荐）：

- 在 `roles` store 提供语义化方法（现有 `canViewDraftProductionOrder()`、`canViewOrderFinancials()`）
- 页面用这些方法控制列、区块、提示文案

### 4.3 操作可执行（操作权限）

- 权限定义：`src/mock/data.js` 的 `ACTION_DEFS`
- 页面校验：`rolesStore.can('action_xxx')`
- 无权限体验：禁用按钮 + tooltip（`permissionTip('action_xxx')`）
- 权限提示文案统一映射：`src/utils/permissionMeta.js`

---

## 5. 审批机制如何实现

### 5.1 审批数据结构

- Store：`src/stores/approvals.js`
- 基础字段：`id/type/ref/customer/submitter/time/status`
- 状态流：`待审批 -> 已通过/已退回`

### 5.2 发起审批（业务页）

常见步骤：

1. 业务页先校验是否可提交
2. 防重：`approvalsStore.hasPendingTypeRef(type, ref)`
3. 调 `approvalsStore.addPending({...})`

### 5.3 审批处理（审批详情页）

在 `ApprovalDetail` 中：

- 先按权限判断能否处理（`rolesStore.canProcessApproval(item)`）
- 通过/退回时：
  - 回写业务 store（如 PR 状态、PO 财务审核状态等）
  - 再回写审批状态（`approvalsStore.setStatus`）

### 5.4 审批权限映射

- `rolesStore.canProcessApproval()`：审批类型 -> 权限 key
- `src/utils/approvalPermission.js`：用于提示文案与显示

---

## 6. 如何新增一个模块

以“新增售后模块”为例：

1. 新建页面目录与页面文件（如 `src/views/afterSales/AfterSalesList.vue`）
2. 若有数据域，新建 Store（如 `src/stores/afterSales.js`）
3. 在 `src/mock/data.js` 的 `MENU_DEFS` 新增菜单项（`key/title/path/icon`）
4. 在 `src/router/index.js` 新增路由，并设置 `meta.perm` 为同一 `key`
5. 在 `src/stores/roles.js` 默认角色里按需加入该模块权限 key
6. 页面内按需补操作权限（`ACTION_DEFS` + `rolesStore.can`）
7. 若涉及审批，补审批类型与映射（见第 8 节）

---

## 7. 如何新增页面（现有模块内）

1. 在对应目录新建页面组件
2. 在路由新增路径，配置 `meta.title` 和 `meta.perm`
3. 若页面需要菜单入口：
   - 主入口放 `MENU_DEFS`
   - 子页面可不放菜单，仅由列表页跳转
4. 用 `rolesStore.can('xxx')` 控制操作按钮
5. 对无权限按钮采用“禁用 + tooltip”统一体验

---

## 8. 如何新增“操作权限 + 审核”

场景：新增一个操作，且操作结果需审批后生效。

### 8.1 新增操作权限 key

在 `src/mock/data.js` 的 `ACTION_DEFS` 增加一条：

- key：`action_xxx`
- title：建议“角色无关描述”

### 8.2 角色赋权

在 `src/stores/roles.js`：

- `defaultRoles()` 给默认角色分配
- 如是历史兼容场景，在 `migrateLoadedRoles()` 做增量补权

### 8.3 页面接入权限控制

- 按钮显示/禁用由 `rolesStore.can('action_xxx')`
- 无权限提示：`permissionTip('action_xxx')`

### 8.4 接入审批

1. 业务页提交审批：`approvalsStore.addPending({ type, ref, ... })`
2. `rolesStore.canProcessApproval` 增加审批类型映射
3. `approvalPermission.js` 增加同映射（用于提示）
4. `ApprovalDetail.vue` 处理通过/退回时回写业务状态

---

## 9. 如何调整“页面权限 / 内容权限 / 操作权限”

### 9.1 调整页面访问权限

- 改 `MENU_DEFS`（菜单定义）
- 改路由 `meta.perm`
- 角色中增删该权限 key

### 9.2 调整内容查看权限

- 新增内容权限 key（建议前缀 `perm_view_`）
- 在 `roles` store 增加语义方法（如 `canViewXxx`）
- 页面中用该方法控制列/区块展示

### 9.3 调整操作执行权

- 新增/调整 `action_` 权限 key
- 页面按钮逻辑改为 `rolesStore.can('action_xxx')`
- 同步无权限提示（`permissionTip`）

---

## 10. 出货模块参考实现（推荐样板）

`src/views/Shipping.vue` 当前包含完整样板，可复用于其他模块：

- 条件检查列表（通过/未通过）
- 提交按钮业务禁用（不仅是权限禁用）
- 历史记录表 + 批次打印
- 失败原因就地提示（`submitBlockReason`）

`src/stores/productionOrders.js` 中：

- `recordShipment` 同时更新累计量与历史记录
- `migrateShipmentRecords` 做旧数据兼容

---

## 11. 数据迁移与版本建议

各 store 采用 `SCHEMA_VER` + `localStorage` 迁移模式。

建议：

- 数据结构变化时，优先补迁移函数，不直接清空数据
- 只有破坏性重构才提升 schema 并清理旧缓存
- 迁移函数要幂等（多次执行结果一致）

---

## 12. 开发与联调检查清单

新增功能后至少检查：

1. 路由可达（有权角色）
2. 路由拦截生效（无权角色）
3. 菜单显示正确
4. 操作权限禁用/提示正确
5. 内容权限展示正确
6. 审批发起、防重、通过/退回回写正确
7. 本地数据迁移不丢失
8. `npm run build` 可通过

---

## 13. 约定与建议

- 权限文案保持“角色无关”，避免后续组织调整导致歧义
- 所有“无权限”场景使用统一提示工具，避免硬编码
- 所有关键流程（采购、出货、财务）优先做“可解释状态”而非黑盒按钮
- 新页面尽量提供“状态说明 + 异常提示 + 历史记录”

---

## 14. 参考模板

如果你要快速新增业务模块，建议直接参考：

- `docs/MODULE_TEMPLATE_AFTERSALES.md`

该模板提供“从菜单到审批回写”的完整路径与代码骨架，可按同模式复制到其他模块。

