/** 生产订单种子数据（以订单为主线；厂长下达后各岗位按流程推进） */
export const productionOrders = [
  {
    id: 'MO-2026-0319-001',
    customer: '徐州立峰',
    customerType: '国内',
    signedAt: '2026-03-18',
    dueDate: '2026-04-20',
    owner: '徐总',
    status: '备货中',
    totalQty: 2,
    remarkEntries: [
      {
        id: 're-seed-1',
        text: '厂长下达；标准交期，注意气胀轴配套。',
        priority: 'normal',
        createdAt: '2026-03-18',
        createdBy: '徐总',
      },
    ],
    lines: [
      {
        unit: '徐州立峰',
        model: '800 切缝 3反1正 伺服款',
        temp: '热',
        stitch: '双针',
        qty: 2,
        punch: '—',
        note: '配气胀轴 1 条；送波浪刀 1 把',
      },
    ],
    shippedQty: 0,
    shipReleaseApproved: false,
    shipReleaseBy: '',
    allowPartialShip: true,
    contractAmount: 186000,
    receivedAmount: 60000,
  },
  {
    id: 'MO-2026-0312-008',
    customer: '温州百川',
    customerType: '国内',
    signedAt: '2026-03-10',
    dueDate: '2026-04-15',
    owner: '徐总',
    status: '待出货',
    totalQty: 1,
    remarkEntries: [
      {
        id: 're-seed-2a',
        text: '客户强调功能点需在出厂前联调确认。',
        priority: 'high',
        createdAt: '2026-03-10',
        createdBy: '徐总',
      },
      {
        id: 're-seed-2b',
        text: '出厂前与客户视频联调时间待销售确认。',
        priority: 'normal',
        createdAt: '2026-03-12',
        createdBy: '李工',
      },
    ],
    lines: [
      {
        unit: '温州百川',
        model: '1300 钉孔收卷',
        temp: '冷',
        stitch: '单针',
        qty: 1,
        punch: '标准',
        note: '带自动离合功能；配切刀倒转按钮（客户强调）',
      },
    ],
    shippedQty: 0,
    shipReleaseApproved: true,
    shipReleaseBy: '厂长',
    allowPartialShip: false,
    contractAmount: 128000,
    receivedAmount: 128000,
  },
  {
    id: 'MO-2026-0301-003',
    customer: '昆发印尼',
    customerType: '出口',
    signedAt: '2026-03-01',
    dueDate: '2026-05-10',
    owner: '徐总',
    status: '草稿',
    totalQty: 3,
    remarkEntries: [
      {
        id: 're-seed-3',
        text: '出口发运；交期以备注与合同为准。',
        priority: 'normal',
        createdAt: '2026-03-01',
        createdBy: '徐总',
      },
    ],
    lines: [
      {
        unit: '昆发印尼',
        model: '中档 800',
        temp: '热',
        stitch: '同步',
        qty: 3,
        punch: '—',
        note: '木箱包装；配英文说明书',
      },
    ],
    shippedQty: 0,
    shipReleaseApproved: false,
    shipReleaseBy: '',
    allowPartialShip: true,
    contractAmount: 420000,
    receivedAmount: 0,
  },
]

export const purchaseRequests = [
  {
    id: 'PR-2026-0320-01',
    productionOrderId: 'MO-2026-0319-001',
    applicant: '赵采购',
    date: '2026-03-20',
    status: '已通过',
    lines: [
      { desc: '伺服电机套装', spec: '按BOM', qty: 2, unit: '套', needDate: '2026-04-06', supplier: '华东机电', note: '' },
      { desc: '超声波组件', spec: '1 付', qty: 1, unit: '付', needDate: '2026-04-08', supplier: '超声科技', note: '与订单行备注一致' },
    ],
  },
]

export const purchaseOrders = [
  {
    id: 'PO-2026-0321-01',
    supplier: '华东机电',
    requestId: 'PR-2026-0320-01',
    date: '2026-03-21',
    status: '执行中',
    financeAuditStatus: '已通过',
    lines: [
      { desc: '伺服电机套装', qty: 2, unit: '套', price: 4200, amount: 8400, due: '2026-04-06' },
    ],
    arrivals: [
      { batch: 1, date: '2026-03-28', qty: 1, by: '赵采购', note: '先到一批' },
    ],
  },
]

export const approvals = [
  { id: 'AP-001', type: '结案审批', ref: 'MO-2026-0312-008', customer: '温州百川', submitter: '财务部', time: '2026-04-10 09:30', status: '待审批' },
  { id: 'AP-002', type: '采购申请', ref: 'PR-2026-0320-01', customer: '—', submitter: '赵采购', time: '2026-03-20 14:00', status: '已通过' },
]

/**
 * 按钮/操作权限（与 useRolesStore().can(key) 配合，不出现在侧栏）
 * 在「角色管理」中与菜单一并勾选
 */
export const ACTION_DEFS = [
  { key: 'perm_view_draft_order', title: '内容·查看草稿生产订单' },
  { key: 'perm_view_order_financials', title: '内容·查看订单金额与回款' },
  { key: 'action_customer_create', title: '操作·客户管理·新建客户' },
  { key: 'action_mo_create', title: '操作·新建生产订单' },
  { key: 'action_mo_issue', title: '操作·生产订单·下发订单（草稿→已下发）' },
  { key: 'action_mo_workshop_judge', title: '操作·生产订单·工艺判读（已下发/备货中/生产中）' },
  { key: 'action_design_complete', title: '操作·生产订单·设计完成（设计中→备货中）' },
  { key: 'action_mo_request_ship', title: '操作·生产订单·申请出货审批（生产中→待出货审批）' },
  { key: 'action_ship_release', title: '操作·出货审批·同意出货（待出货审批→待出货）' },
  { key: 'action_ship_reject', title: '操作·出货审批·退回生产（待出货审批→生产中）' },
  { key: 'action_ship_submit', title: '操作·出货确认提交' },
  { key: 'action_finance_apply_close', title: '操作·财务·申请结案' },
  { key: 'action_approve_close', title: '操作·审批·结案类' },
  { key: 'action_approve_pr', title: '操作·审批·采购申请类' },
  { key: 'action_finance_audit_po', title: '操作·审批·采购单财务审核' },
  { key: 'action_pr_submit', title: '操作·采购·提交申请审批' },
  { key: 'action_po_submit_finance', title: '操作·采购·提交采购单财务审核' },
]

/** 菜单权限 key 与路由对应 */
export const MENU_DEFS = [
  { key: 'dashboard', title: '工作台', path: '/dashboard', icon: 'Odometer' },
  { key: 'production_order', title: '生产订单', path: '/production-orders', icon: 'Document' },
  { key: 'customer', title: '客户管理', path: '/customers', icon: 'User' },
  { key: 'supplier', title: '供应商管理', path: '/suppliers', icon: 'OfficeBuilding' },
  { key: 'purchase', title: '采购', path: '/purchase/requests', icon: 'ShoppingCart' },
  { key: 'shipping', title: '出货', path: '/shipping', icon: 'Van' },
  { key: 'finance', title: '财务应收', path: '/finance/receivables', icon: 'Wallet' },
  { key: 'approval', title: '审批中心', path: '/approval', icon: 'Stamp' },
  { key: 'users', title: '用户账号', path: '/system/users', icon: 'Avatar' },
  { key: 'roles', title: '角色管理', path: '/system/roles', icon: 'UserFilled' },
  { key: 'order_workflow', title: '订单状态流转', path: '/system/order-workflow', icon: 'Operation' },
  { key: 'sales_next', title: '销售', path: '/sales-next', icon: 'Sell', placeholder: true },
  { key: 'production', title: '车间执行', path: '/production', icon: 'SetUp', placeholder: true },
  { key: 'warehouse', title: '仓库', path: '/warehouse', icon: 'Box', placeholder: true },
]
