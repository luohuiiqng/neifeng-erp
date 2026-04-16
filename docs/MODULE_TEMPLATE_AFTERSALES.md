# 模块落地模板（示例：新增售后模块）

本模板用于“从 0 到 1”新增业务模块。你可以把“售后”替换成任意新模块（质量、设备、工单等）。

---

## 0. 目标效果

新增一个完整模块，具备：

- 菜单可见 + 路由可访问
- 列表页 + 详情页
- Store 持久化
- 页面权限控制
- 操作权限控制
- 可选审批流接入

---

## 1. 新增菜单权限与操作权限

文件：`src/mock/data.js`

### 1.1 菜单权限（页面可见）

在 `MENU_DEFS` 增加：

```js
{ key: 'after_sales', title: '售后', path: '/after-sales', icon: 'Service' }
```

### 1.2 操作权限（按钮可执行）

在 `ACTION_DEFS` 增加（示例）：

```js
{ key: 'action_as_create', title: '操作·售后·新建工单' },
{ key: 'action_as_submit', title: '操作·售后·提交审核' },
{ key: 'action_approve_as', title: '操作·审批·售后工单类' },
```

---

## 2. 给默认角色分配权限

文件：`src/stores/roles.js`

在 `defaultRoles()` 中按业务分配：

- 例如 `director` 增加：`after_sales`, `action_approve_as`
- 例如 `workshop` 增加：`after_sales`, `action_as_create`, `action_as_submit`

如果这是“老项目升级”，还建议在 `migrateLoadedRoles()` 里补充增量权限，避免旧本地数据没有新权限。

---

## 3. 新建 Store（数据域）

新建文件：`src/stores/afterSales.js`

建议骨架：

```js
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'nf_erp_after_sales'

export const useAfterSalesStore = defineStore('afterSales', () => {
  const items = ref([])

  watch(
    items,
    (v) => localStorage.setItem(STORAGE_KEY, JSON.stringify(v)),
    { deep: true },
  )

  function createTicket(payload) {
    const id = `AS-${Date.now()}`
    items.value.unshift({
      id,
      status: '草稿',
      createdAt: new Date().toISOString().slice(0, 10),
      ...payload,
    })
    return id
  }

  function setStatus(id, status) {
    const row = items.value.find((x) => x.id === id)
    if (row) row.status = status
  }

  function getById(id) {
    return items.value.find((x) => x.id === id) || null
  }

  return { items, createTicket, setStatus, getById }
})
```

---

## 4. 新增页面

建议新增两个页面：

- `src/views/afterSales/AfterSalesList.vue`
- `src/views/afterSales/AfterSalesDetail.vue`

列表页负责：

- 查询/筛选
- 新建
- 进入详情

详情页负责：

- 展示主信息
- 提交审核 / 撤回 / 关闭等动作
- 历史记录

---

## 5. 接入路由

文件：`src/router/index.js`

在主布局 children 中增加：

```js
{
  path: 'after-sales',
  name: 'AfterSalesList',
  meta: { title: '售后', perm: 'after_sales' },
  component: () => import('@/views/afterSales/AfterSalesList.vue'),
},
{
  path: 'after-sales/:id',
  name: 'AfterSalesDetail',
  meta: { title: '售后详情', perm: 'after_sales' },
  component: () => import('@/views/afterSales/AfterSalesDetail.vue'),
},
```

> `meta.perm` 必须与 `MENU_DEFS.key` 一致，否则菜单和路由权限会脱节。

---

## 6. 页面权限 / 内容权限 / 操作权限写法

### 6.1 页面权限（路由层）

已由 `meta.perm + router.beforeEach + rolesStore.can` 接管，无需每页重复写。

### 6.2 内容权限（字段可见）

示例：

```vue
<el-table-column v-if="rolesStore.can('perm_view_order_financials')" prop="cost" label="成本" />
```

推荐做法：在 `roles` store 封装语义方法（如 `canViewAfterSalesCost()`）再给页面使用。

### 6.3 操作权限（按钮可执行）

示例：

```vue
<el-tooltip :disabled="rolesStore.can('action_as_submit')" :content="permissionTip('action_as_submit')">
  <span>
    <el-button :disabled="!rolesStore.can('action_as_submit')" @click="onSubmit">提交审核</el-button>
  </span>
</el-tooltip>
```

---

## 7. 接入审批流（可选）

### 7.1 业务页提交审批

```js
if (approvalsStore.hasPendingTypeRef('售后工单', ticket.id)) return
approvalsStore.addPending({
  id: `AP-AS-${ticket.id}-${Date.now()}`,
  type: '售后工单',
  ref: ticket.id,
  customer: ticket.customer || '—',
  submitter: rolesStore.currentRole?.name || '—',
  time: nowTimeStr(),
})
```

### 7.2 审批权限映射

1) `src/stores/roles.js` 的 `canProcessApproval()` 新增：

```js
if (approval.type === '售后工单') return can('action_approve_as')
```

2) `src/utils/approvalPermission.js` 新增：

```js
if (approval.type === '售后工单') return 'action_approve_as'
```

### 7.3 审批结果回写业务

在 `ApprovalDetail.vue` 同类分支里：

- 审批通过 -> `afterSalesStore.setStatus(ref, '已通过')`
- 审批退回 -> `afterSalesStore.setStatus(ref, '已退回')`

---

## 8. 菜单与布局自动生效说明

`MainLayout` 的菜单来自 `MENU_DEFS`，并通过 `rolesStore.can(item.key)` 自动过滤。

因此只要你：

1. 在 `MENU_DEFS` 增加菜单项  
2. 在角色 permissions 分配该 key  

就会自动出现在左侧菜单，无需额外手改布局。

---

## 9. 最小提测清单（新增模块必走）

- [ ] 菜单可见性正确（有权看得到，无权看不到）
- [ ] 直接输入 URL 也会被路由权限拦截
- [ ] 新建/编辑/提交按钮权限正确
- [ ] 无权限有 tooltip（具体权限名）
- [ ] 审批待办可生成，防重复提交
- [ ] 审批通过/退回能正确回写业务状态
- [ ] `npm run build` 通过

---

## 10. 建议命名规范

- 菜单权限：`xxx_module`（如 `after_sales`）
- 内容权限：`perm_view_xxx`
- 操作权限：`action_xxx`
- 审批类型：用业务名（如 `售后工单`）

