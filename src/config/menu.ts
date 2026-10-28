import type { Component } from 'vue'
import type { AppCode } from './apps'

export interface MenuNode {
  key: string
  path: string
  title: string
  icon: string
  /** list = 通用列表页；custom = 独立页面组件名 */
  view?: 'list' | 'custom'
  /** 独立页面组件 */
  component?: Component
  /** 页面定义 key（view=list 时） */
  pageKey?: string
  children?: MenuNode[]
  /** 菜单右上角徽标 */
  badge?: number | string
  /**
   * 浏览器标签页标题。留空则用 title。
   * 四个应用域的落地页菜单都叫「工作台」，靠它区分（如「财务工作台」）。
   */
  docTitle?: string
  /**
   * 所属应用域。
   * 顶层分组必填；子节点默认继承父节点。留空表示公共节点（如总览），所有登录用户可见。
   */
  app?: AppCode
}

/** 侧边栏菜单树 —— 一套系统，四个域
 *
 * 约定：每个应用域的**第一个子节点都是「工作台」**，即进入该系统后的落地页
 * （承接页点卡片 → 顶栏应用切换器 → 直接访问分组路径，三条路径都落到工作台）。
 * 跨域的公共节点叫「总览」，避免与应用内的「工作台」重名。
 */
export const menuTree: MenuNode[] = [
  {
    key: 'dashboard',
    path: '/dashboard',
    title: '总览',
    docTitle: '总览',
    icon: 'DashboardOutlined',
    view: 'custom',
    component: () => import('@/views/dashboard/index.vue'),
  },

  /* ============================ CRM ============================ */
  {
    key: 'crm',
    path: '/crm',
    title: 'CRM 客户关系',
    icon: 'TeamOutlined',
    app: 'crm',
    children: [
      { key: 'crm-dashboard', path: '/crm/dashboard', title: '工作台', docTitle: 'CRM 工作台', icon: 'DashboardOutlined', view: 'custom', component: () => import('@/views/crm/Overview.vue') },
      { key: 'crm-kanban', path: '/crm/kanban', title: '商机看板', icon: 'PartitionOutlined', view: 'custom', component: () => import('@/views/crm/Kanban.vue') },
      { key: 'crm-lead-pool', path: '/crm/lead-pool', title: '线索池', icon: 'InboxOutlined', pageKey: 'leadPool' },
      { key: 'crm-lead', path: '/crm/lead', title: '线索管理', icon: 'TagsOutlined', pageKey: 'lead' },
      { key: 'crm-account', path: '/crm/account', title: '客户管理', icon: 'ShopOutlined', pageKey: 'account' },
      { key: 'crm-account-360', path: '/crm/account/360', title: '客户 360 视图', icon: 'UserOutlined', view: 'custom', component: () => import('@/views/crm/Customer360.vue') },
      { key: 'crm-contact', path: '/crm/contact', title: '联系人管理', icon: 'IdcardOutlined', pageKey: 'contact' },
      { key: 'crm-opportunity', path: '/crm/opportunity', title: '商机管理', icon: 'SolutionOutlined', pageKey: 'opportunity' },
      { key: 'crm-quote', path: '/crm/quote', title: '报价单', icon: 'FileTextOutlined', pageKey: 'quote' },
      { key: 'crm-contract', path: '/crm/contract', title: '合同管理', icon: 'FileProtectOutlined', pageKey: 'contract' },
      { key: 'crm-receipt', path: '/crm/receipt', title: '回款计划', icon: 'WalletOutlined', pageKey: 'receipt' },
      { key: 'crm-follow', path: '/crm/follow', title: '跟进记录', icon: 'ScheduleOutlined', pageKey: 'follow' },
      { key: 'crm-funnel', path: '/crm/funnel', title: '销售漏斗', icon: 'FilterOutlined', view: 'custom', component: () => import('@/views/crm/Funnel.vue') },
      { key: 'crm-target', path: '/crm/target', title: '销售目标', icon: 'AimOutlined', pageKey: 'target' },
      { key: 'crm-product', path: '/crm/product', title: '产品与定价', icon: 'AppstoreOutlined', pageKey: 'product' },
    ],
  },

  /* ============================ OA ============================ */
  {
    key: 'oa',
    path: '/oa',
    title: 'OA 协同办公',
    icon: 'CoffeeOutlined',
    app: 'oa',
    children: [
      { key: 'oa-dashboard', path: '/oa/dashboard', title: '工作台', docTitle: 'OA 工作台', icon: 'DashboardOutlined', view: 'custom', component: () => import('@/views/oa/Overview.vue') },
      { key: 'oa-todo', path: '/oa/todo', title: '待办中心', icon: 'CarryOutOutlined', view: 'custom', component: () => import('@/views/oa/Todo.vue'), badge: 12 },
      { key: 'oa-approval', path: '/oa/approval', title: '审批中心', icon: 'AuditOutlined', pageKey: 'approval' },
      { key: 'oa-flow', path: '/oa/flow', title: '流程模板', icon: 'ApartmentOutlined', pageKey: 'flow' },
      { key: 'oa-attendance', path: '/oa/attendance', title: '考勤管理', icon: 'CalendarOutlined', view: 'custom', component: () => import('@/views/oa/Attendance.vue') },
      { key: 'oa-leave', path: '/oa/leave', title: '请假管理', icon: 'HighlightOutlined', pageKey: 'leave' },
      { key: 'oa-travel', path: '/oa/travel', title: '出差管理', icon: 'CompassOutlined', pageKey: 'travel' },
      { key: 'oa-overtime', path: '/oa/overtime', title: '加班申请', icon: 'BulbOutlined', pageKey: 'overtime' },
      { key: 'oa-expense', path: '/oa/expense', title: '费用报销', icon: 'PayCircleOutlined', pageKey: 'expense' },
      { key: 'oa-notice', path: '/oa/notice', title: '通知公告', icon: 'NotificationOutlined', pageKey: 'notice' },
      { key: 'oa-meeting', path: '/oa/meeting', title: '会议室与会议', icon: 'VideoCameraOutlined', pageKey: 'meeting' },
      { key: 'oa-knowledge', path: '/oa/knowledge', title: '知识库', icon: 'ReadOutlined', pageKey: 'knowledge' },
      { key: 'oa-org', path: '/oa/org', title: '组织架构', icon: 'ClusterOutlined', view: 'custom', component: () => import('@/views/oa/Org.vue') },
      { key: 'oa-staff', path: '/oa/staff', title: '员工档案', icon: 'IdcardOutlined', pageKey: 'staff' },
      { key: 'oa-seal', path: '/oa/seal', title: '印章管理', icon: 'SafetyCertificateOutlined', pageKey: 'seal' },
      { key: 'oa-okr', path: '/oa/okr', title: '目标管理 OKR', icon: 'AimOutlined', pageKey: 'okr' },
      { key: 'oa-schedule', path: '/oa/schedule', title: '日程安排', icon: 'CalendarOutlined', pageKey: 'schedule' },
    ],
  },

  /* ========================== 财务 ============================ */
  {
    key: 'fin',
    path: '/finance',
    title: '财务中心',
    icon: 'BankOutlined',
    app: 'finance',
    children: [
      { key: 'fin-dashboard', path: '/finance/dashboard', title: '工作台', docTitle: '财务工作台', icon: 'DashboardOutlined', view: 'custom', component: () => import('@/views/finance/Overview.vue') },
      { key: 'fin-bookset', path: '/finance/bookset', title: '账套管理', icon: 'ContainerOutlined', pageKey: 'bookset' },
      { key: 'fin-account', path: '/finance/account', title: '会计科目', icon: 'ProfileOutlined', pageKey: 'finAccount' },
      { key: 'fin-voucher', path: '/finance/voucher', title: '凭证管理', icon: 'FileDoneOutlined', pageKey: 'voucher' },
      { key: 'fin-voucher-new', path: '/finance/voucher/new', title: '凭证录入', icon: 'FormOutlined', view: 'custom', component: () => import('@/views/finance/VoucherEntry.vue') },
      { key: 'fin-gl', path: '/finance/gl', title: '总账明细', icon: 'BookOutlined', pageKey: 'gl' },
      { key: 'fin-ar', path: '/finance/ar', title: '应收管理', icon: 'DownloadOutlined', pageKey: 'ar' },
      { key: 'fin-ap', path: '/finance/ap', title: '应付管理', icon: 'UploadOutlined', pageKey: 'ap' },
      { key: 'fin-invoice', path: '/finance/invoice', title: '发票管理', icon: 'ReconciliationOutlined', pageKey: 'invoice' },
      { key: 'fin-bank', path: '/finance/bank', title: '银行账户', icon: 'BankOutlined', pageKey: 'bank' },
      { key: 'fin-flow', path: '/finance/flow', title: '银行流水', icon: 'SwapOutlined', pageKey: 'bankFlow' },
      { key: 'fin-recon', path: '/finance/recon', title: '对账管理', icon: 'SyncOutlined', pageKey: 'recon' },
      { key: 'fin-asset', path: '/finance/asset', title: '固定资产', icon: 'LaptopOutlined', pageKey: 'asset' },
      { key: 'fin-budget', path: '/finance/budget', title: '预算管理', icon: 'PieChartOutlined', view: 'custom', component: () => import('@/views/finance/Budget.vue') },
      { key: 'fin-report', path: '/finance/report', title: '财务报表', icon: 'BarChartOutlined', view: 'custom', component: () => import('@/views/finance/Reports.vue') },
      { key: 'fin-close', path: '/finance/close', title: '期末结账', icon: 'LockOutlined', pageKey: 'close' },
      { key: 'fin-cashier', path: '/finance/cashier', title: '出纳日记账', icon: 'MoneyCollectOutlined', pageKey: 'cashier' },
      { key: 'fin-tax', path: '/finance/tax', title: '税务申报', icon: 'FlagOutlined', pageKey: 'tax' },
    ],
  },

  /* ========================== 平台 ============================ */
  {
    key: 'platform',
    path: '/platform',
    title: '平台配置',
    icon: 'SettingOutlined',
    app: 'platform',
    children: [
      { key: 'pl-dashboard', path: '/platform/dashboard', title: '工作台', docTitle: '平台工作台', icon: 'DashboardOutlined', view: 'custom', component: () => import('@/views/platform/Overview.vue') },
      { key: 'pl-user', path: '/platform/user', title: '用户管理', icon: 'UserOutlined', pageKey: 'sysUser' },
      { key: 'pl-role', path: '/platform/role', title: '角色权限', icon: 'SafetyOutlined', pageKey: 'role' },
      { key: 'pl-dept', path: '/platform/dept', title: '部门管理', icon: 'ApartmentOutlined', pageKey: 'dept' },
      { key: 'pl-dict', path: '/platform/dict', title: '数据字典', icon: 'TagsOutlined', pageKey: 'dict' },
      { key: 'pl-number', path: '/platform/number', title: '编号规则', icon: 'NumberOutlined', pageKey: 'numberRule' },
      { key: 'pl-tenant', path: '/platform/tenant', title: '租户与套餐', icon: 'GoldOutlined', pageKey: 'tenant' },
      { key: 'pl-message', path: '/platform/message', title: '消息中心', icon: 'MessageOutlined', pageKey: 'message' },
      { key: 'pl-log', path: '/platform/log', title: '操作日志', icon: 'HistoryOutlined', pageKey: 'opLog' },
      { key: 'pl-login-log', path: '/platform/login-log', title: '登录日志', icon: 'LoginOutlined', pageKey: 'loginLog' },
      { key: 'pl-config', path: '/platform/config', title: '参数配置', icon: 'ControlOutlined', pageKey: 'config' },
      { key: 'pl-api', path: '/platform/api', title: '开放平台 API', icon: 'ApiOutlined', view: 'custom', component: () => import('@/views/platform/ApiHub.vue') },
    ],
  },
]

/* ===================== 权限相关工具 ===================== */

/**
 * 按应用域过滤菜单树：无权访问的域整组剔除，空组也一并去掉。
 * 注意：这里只过滤「显示」，路由表仍是全量静态注册的，
 * 真正的准入校验放在路由守卫里 —— 否则刷新无权页面会 404。
 */
export function filterMenuByApps(nodes: MenuNode[], apps: AppCode[]): MenuNode[] {
  const allow = new Set<AppCode>(apps)
  const out: MenuNode[] = []
  for (const node of nodes) {
    if (node.app && !allow.has(node.app)) continue
    if (node.children?.length) {
      const children = node.children.filter((c) => !c.app || allow.has(c.app))
      if (!children.length) continue
      out.push({ ...node, children })
    } else {
      out.push(node)
    }
  }
  return out
}

/** 路径 → 所属应用域；公共节点（工作台等）返回 '' */
export function appOfPath(path: string): AppCode | '' {
  const norm = (path.split('?')[0] || '').replace(/\/+$/, '') || '/'
  for (const group of menuTree) {
    if (!group.children) continue
    if (norm === group.path || norm.startsWith(`${group.path}/`)) return group.app ?? ''
  }
  return ''
}

/** 路径 → 菜单节点 */
export function findNodeByPath(path: string): MenuNode | undefined {
  const norm = (path.split('?')[0] || '').replace(/\/+$/, '') || '/'
  for (const group of menuTree) {
    if (!group.children) continue
    const hit = group.children.find((c) => c.path === norm)
    if (hit) return hit
  }
  return menuTree.find((n) => n.path === norm)
}

/** 扁平化菜单树：key → 节点 */
export function flattenMenu(nodes: MenuNode[] = menuTree): Record<string, MenuNode> {
  const map: Record<string, MenuNode> = {}
  const walk = (list: MenuNode[]) => {
    for (const n of list) {
      map[n.key] = n
      if (n.children) walk(n.children)
    }
  }
  walk(nodes)
  return map
}
