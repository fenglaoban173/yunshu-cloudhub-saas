/**
 * 动作语义表（Action Rules）
 * ---------------------------------------------------------------------------
 * 全站 48 个列表页的按钮名称并不写在页面代码里，而是集中在 `src/mock/pages.ts`
 * 的 PageDef 上（`primaryAction` / `toolbar` / `rowActions`）。这里把**每一个动作名**
 * 映射到具体的交互行为（kind），由 `composables/useAction.ts` 统一分发执行。
 *
 * 收益：
 *  1. 48 个列表页共用一套新增 / 编辑 / 审批 / 导出交互，不需要逐页写 handler；
 *  2. 动作语义集中在一张表里，可审阅、可扩展——新增动作只要加一行；
 *  3. 独立视图（看板 / 待办 / 凭证录入 / API 开放平台…）复用同一套动作，
 *     全站按钮行为保持一致。
 *
 * kind 语义：
 *  - create    打开「新增」表单（表单字段由 PageDef.columns 自动生成）
 *  - edit      打开「编辑」表单（带入当前行）
 *  - remove    二次确认后删除记录
 *  - approve   二次确认后置为「通过」类状态
 *  - reject    二次确认后置为「驳回」类状态
 *  - setStatus 二次确认后把状态字段直接改写为指定值
 *  - toggle    切换开关型字段（置顶 / 启停）
 *  - assign    分配责任人 / 角色（弹出人员选择）
 *  - export    导出当前结果集为 CSV（真实下载）
 *  - import    批量导入（模拟追加若干条记录）
 *  - detail    打开详情抽屉（只读）
 *  - convert   基于当前行创建关联单据（打开目标页新增表单并预填）
 *  - advance   推进阶段（线索→商机→合同等流转）
 *  - notify    产生一条提醒 / 催办 / 分享动作
 *  - preview   打开预览面板（简报、流程设计、权限树、调试响应…）
 *  - open      跳转到关联页面
 *  - custom    特殊动作，交给 useAction 里的具名处理器
 */
import type { AppCode } from '@/config/apps'

export type ActionKind =
  | 'create'
  | 'edit'
  | 'remove'
  | 'approve'
  | 'reject'
  | 'setStatus'
  | 'toggle'
  | 'assign'
  | 'export'
  | 'import'
  | 'detail'
  | 'convert'
  | 'advance'
  | 'notify'
  | 'preview'
  | 'open'
  | 'custom'

export interface ActionRule {
  kind: ActionKind
  /** 实体名（提示文案用）；缺省时取页面标题 */
  entity?: string
  /** convert：目标页面 key；open：目标路由 */
  target?: string
  path?: string
  /** 改写的字段名 */
  field?: string
  /** 改写后的目标值 */
  value?: string
  /** 开关型动作的另一端取值（toggle 用） */
  value2?: string
  /**
   * convert：转化到目标页时固定写入的值（优先级最高，覆盖同名字段）。
   * 支持三个占位符：@amount 取来源记录的金额、@user 取当前用户、@today 取今天。
   */
  preset?: Record<string, any>
  /** 危险操作（红色） */
  danger?: boolean
  /** 需要先勾选数据 */
  needSelect?: boolean
  /** 动作动词（确认框标题与成功提示用），如「置顶」「下架」 */
  verb?: string
  /** 操作完成后跳转的路由 */
  goto?: string
  /** custom 处理器名 */
  custom?: string
  /** 自定义提示文案 */
  tip?: string
}

/** 目标页面 key → 该页所属应用域 */
export const convertTargetApp: Record<string, AppCode> = {
  lead: 'crm', leadPool: 'crm', account: 'crm', contact: 'crm', opportunity: 'crm',
  quote: 'crm', contract: 'crm', receipt: 'crm', follow: 'crm', target: 'crm', product: 'crm',
  approval: 'oa', flow: 'oa', leave: 'oa', travel: 'oa', overtime: 'oa', expense: 'oa',
  notice: 'oa', meeting: 'oa', knowledge: 'oa', staff: 'oa', seal: 'oa', okr: 'oa', schedule: 'oa',
  bookset: 'finance', finAccount: 'finance', voucher: 'finance', gl: 'finance', ar: 'finance',
  ap: 'finance', invoice: 'finance', bank: 'finance', bankFlow: 'finance', recon: 'finance',
  asset: 'finance', close: 'finance', cashier: 'finance', tax: 'finance',
  sysUser: 'platform', role: 'platform', dept: 'platform', dict: 'platform',
  numberRule: 'platform', tenant: 'platform', message: 'platform', opLog: 'platform',
  loginLog: 'platform', config: 'platform',
}

const r = (kind: ActionKind, extra: Partial<ActionRule> = {}): ActionRule => ({ kind, ...extra })

/**
 * 动作名 → 行为。全量覆盖 48 个列表页用到的每一个动作。
 */
export const actionRules: Record<string, ActionRule> = {
  /* ------------------------------ 通用 ------------------------------ */
  编辑: r('edit'),
  导出: r('export'),
  打印: r('export', { tip: '打印版数据' }),
  打印余额调节表: r('export', { tip: '余额调节表' }),
  导出申报表: r('export', { tip: '纳税申报表' }),
  生成对账单: r('export', { tip: '对账单' }),
  导入: r('import'),
  批量导入: r('import'),
  导入流水: r('import'),
  刷新公海: r('custom', { custom: 'releasePool', tip: '已把超时未跟进的线索退回公海' }),

  /* ------------------------------ CRM ------------------------------ */
  新建线索: r('create', { entity: '线索' }),
  新建客户: r('create', { entity: '客户' }),
  新建联系人: r('create', { entity: '联系人' }),
  新建商机: r('create', { entity: '商机' }),
  新建报价: r('create', { entity: '报价单' }),
  新建合同: r('create', { entity: '合同' }),
  新建产品: r('create', { entity: '产品' }),
  领取: r('assign', { field: 'owner', tip: '线索已领取' }),
  分配: r('assign', { field: 'owner' }),
  批量分配: r('assign', { field: 'owner', needSelect: true, entity: '记录' }),
  分配客户: r('assign', { field: 'owner', needSelect: true, entity: '客户' }),
  // 销售目标「批量下发」＝把目标逐条下发给具体负责人
  批量下发: r('assign', { field: 'owner', needSelect: true, entity: '销售目标' }),
  跟进: r('convert', { target: 'follow' }),
  新建跟进: r('convert', { target: 'follow' }),
  转商机: r('convert', { target: 'opportunity' }),
  转客户: r('convert', { target: 'account' }),
  转合同: r('convert', { target: 'contract' }),
  废弃: r('remove', { danger: true }),
  详情: r('detail'),
  推进阶段: r('advance'),
  报价: r('convert', { target: 'quote' }),
  查看漏斗: r('open', { path: '/crm/funnel' }),
  查看: r('detail'),
  发起用印: r('convert', { target: 'approval', preset: { type: '合同用印', status: '审批中' } }),
  批量用印: r('convert', { target: 'approval', needSelect: true, entity: '用印申请', preset: { type: '合同用印', status: '审批中' } }),
  生成应收: r('convert', { target: 'ar', preset: { status: '待回款' } }),
  登记回款: r('convert', { target: 'ar', preset: { status: '待回款' } }),
  发送催收: r('notify', { tip: '催收通知已发送' }),
  拆解: r('preview'),
  价格策略: r('preview'),

  /* ------------------------------ OA ------------------------------ */
  审批: r('approve'),
  批量通过: r('approve', { needSelect: true, value: '已通过', entity: '单据' }),
  转办: r('assign', { field: 'approver' }),
  催办: r('notify', { tip: '已向当前节点处理人发送催办' }),
  新建流程: r('create', { entity: '流程模板' }),
  设计流程: r('preview'),
  版本: r('preview'),
  启停: r('toggle', { field: 'status', value: '启用' }),
  发起请假: r('create', { entity: '请假单' }),
  发起出差: r('create', { entity: '出差单' }),
  发起加班: r('create', { entity: '加班单' }),
  发起报销: r('create', { entity: '报销单' }),
  查看票据: r('preview'),
  生成凭证: r('convert', { target: 'voucher', preset: { status: '草稿', source: '业务单据' } }),
  发布公告: r('create', { entity: '公告' }),
  置顶: r('toggle', { field: 'top', value: '是' }),
  撤回: r('reject', { field: 'status', value: '已撤回' }),
  预订会议室: r('create', { entity: '会议预订' }),
  预订: r('edit'),
  纪要: r('preview'),
  新建文档: r('create', { entity: '文档' }),
  预览: r('preview'),
  分享: r('notify', { tip: '分享链接已复制到剪贴板' }),
  新增员工: r('create', { entity: '员工' }),
  档案: r('detail'),
  调整: r('edit'),
  离职: r('reject', { field: 'status', value: '离职', danger: true }),
  登记印章: r('create', { entity: '印章' }),
  用印申请: r('convert', { target: 'approval', preset: { type: '用章申请', status: '审批中' } }),
  台账: r('detail'),
  新建目标: r('create', { entity: 'OKR' }),
  '拆解 KR': r('preview'),
  自评: r('edit'),
  复盘: r('preview'),
  新建日程: r('create', { entity: '日程' }),
  提醒: r('notify', { tip: '已向参与人发送日程提醒' }),

  /* ------------------------------ 财务 ------------------------------ */
  新建账套: r('create', { entity: '账套' }),
  进入账套: r('open', { path: '/finance/account' }),
  科目: r('open', { path: '/finance/account' }),
  结账: r('setStatus', { field: 'status', value: '已结账' }),
  反结账: r('setStatus', { field: 'status', value: '未结账', danger: true }),
  新增科目: r('create', { entity: '会计科目' }),
  同步至账套: r('custom', { custom: 'syncLedger', tip: '科目已同步至目标账套' }),
  新增下级: r('create', { entity: '下级节点' }),
  新增凭证: r('create', { entity: '凭证' }),
  批量审核: r('approve', { needSelect: true, value: '已审核', entity: '凭证' }),
  审核: r('approve', { value: '已审核' }),
  反审核: r('setStatus', { field: 'status', value: '草稿' }),
  联查单据: r('detail'),
  联查凭证: r('detail'),
  核销: r('approve', { value: '已核销' }),
  收单: r('notify', { tip: '收单请求已发送' }),
  对账: r('detail'),
  批量催收: r('notify', { needSelect: true, tip: '催收通知已发送', entity: '应收单' }),
  批量付款申请: r('convert', { target: 'voucher', needSelect: true, entity: '付款凭证', preset: { status: '草稿', source: '业务单据', debit: 0, credit: '@amount' } }),
  付款: r('setStatus', { field: 'status', value: '已付款' }),
  三单匹配: r('preview'),
  批量查验: r('approve', { needSelect: true, value: '已查验', entity: '发票' }),
  查验: r('approve', { value: '已查验' }),
  开具发票: r('create', { entity: '发票' }),
  开具: r('setStatus', { field: 'status', value: '已开具' }),
  作废: r('setStatus', { field: 'status', value: '已作废', danger: true }),
  新增账户: r('create', { entity: '银行账户' }),
  同步流水: r('import'),
  流水: r('detail'),
  日记账: r('open', { path: '/finance/cashier' }),
  自动匹配: r('custom', { custom: 'autoMatch', tip: '未达流水已自动匹配核销' }),
  开始对账: r('approve', { value: '已对账' }),
  未达项: r('detail'),
  新增资产: r('create', { entity: '资产卡片' }),
  批量折旧: r('custom', { custom: 'depreciate', needSelect: true, tip: '已按规则计提折旧', entity: '资产' }),
  卡片: r('detail'),
  折旧: r('edit'),
  处置: r('setStatus', { field: 'status', value: '已处置' }),
  检查清单: r('preview'),
  登记收支: r('create', { entity: '收支记录' }),
  登记: r('edit'),
  申报: r('setStatus', { field: 'status', value: '已申报' }),
  缴款: r('setStatus', { field: 'status', value: '已缴款' }),
  查看明细: r('detail'),

  /* ------------------------------ 平台 ------------------------------ */
  新增用户: r('create', { entity: '用户' }),
  批量授权: r('assign', { field: 'role', needSelect: true, entity: '用户' }),
  分配角色: r('assign', { field: 'role' }),
  重置密码: r('notify', { tip: '密码已重置为 Cloud@2025' }),
  停用: r('setStatus', { field: 'status', value: '停用', danger: true }),
  新建角色: r('create', { entity: '角色' }),
  分配权限: r('preview'),
  数据权限: r('preview'),
  复制: r('create', { entity: '副本' }),
  新增部门: r('create', { entity: '部门' }),
  删除: r('remove', { danger: true }),
  新建字典: r('create', { entity: '字典' }),
  字典项: r('preview'),
  新建规则: r('create', { entity: '编号规则' }),
  测试: r('preview'),
  开通租户: r('create', { entity: '租户' }),
  开通: r('setStatus', { field: 'status', value: '正常' }),
  续费: r('edit'),
  配置功能: r('preview'),
  全部已读: r('custom', { custom: 'readAll', tip: '全部消息已标记为已读' }),
  变更详情: r('detail'),
  新增参数: r('create', { entity: '参数' }),
  重置: r('setStatus', { field: 'value', value: '（已恢复默认值）' }),

  /* ------------------------------ 批量动作 ------------------------------ */
  /**
   * 批量动作只在勾选了行之后才出现在工具栏上（见 `views/ListPage.vue`）。
   * 全部带 needSelect —— 没勾选就点不到，勾选了才对选中行生效。
   */
  批量导出: r('export', { needSelect: true }),
  批量打印: r('export', { needSelect: true, tip: '打印版数据' }),
  批量退回公海: r('custom', { custom: 'releaseSelected', needSelect: true, tip: '已把选中的线索退回公海' }),
  批量转商机: r('convert', { target: 'opportunity', needSelect: true, entity: '商机' }),
  批量转客户: r('convert', { target: 'account', needSelect: true, entity: '客户' }),
  批量转合同: r('convert', { target: 'contract', needSelect: true, entity: '合同' }),
  批量生成应收: r('convert', { target: 'ar', needSelect: true, entity: '应收单', preset: { status: '待回款' } }),
  批量生成凭证: r('convert', { target: 'voucher', needSelect: true, entity: '凭证', preset: { status: '草稿', source: '业务单据' } }),
  批量推进阶段: r('advance', { needSelect: true, entity: '商机' }),
  批量标记关键: r('setStatus', { field: 'isKey', value: '是', needSelect: true, verb: '标记为关键客户', entity: '联系人' }),
  批量下架: r('setStatus', { field: 'status', value: '下架', needSelect: true, verb: '下架', entity: '产品' }),
  批量启用: r('toggle', { field: 'status', value: '启用', value2: '停用', needSelect: true, entity: '流程' }),
  批量置顶: r('setStatus', { field: 'top', value: '是', needSelect: true, verb: '置顶', entity: '公告' }),
  批量撤回: r('reject', { field: 'status', value: '已撤回', needSelect: true, entity: '公告' }),
  批量提醒: r('notify', { needSelect: true, tip: '提醒已发送' }),
  批量催办: r('notify', { needSelect: true, tip: '已向选中单据的当前处理人发送催办', entity: '单据' }),
  批量开通: r('setStatus', { field: 'status', value: '正常', needSelect: true, verb: '开通', entity: '租户' }),
  批量发布: r('setStatus', { field: 'status', value: '已发布', needSelect: true, verb: '发布', entity: '文档' }),
  批量调整部门: r('assign', { field: 'dept', needSelect: true, entity: '员工' }),
  批量核销: r('approve', { value: '已核销', needSelect: true, entity: '单据' }),
  批量开具: r('setStatus', { field: 'status', value: '已开具', needSelect: true, verb: '开具', entity: '发票' }),
  批量注销: r('setStatus', { field: 'status', value: '已注销', needSelect: true, verb: '注销', entity: '银行账户' }),
  批量自动匹配: r('custom', { custom: 'autoMatch', needSelect: true, tip: '未达流水已自动匹配核销' }),
  批量开始对账: r('approve', { value: '已对账', needSelect: true, entity: '对账单' }),
  批量处置: r('setStatus', { field: 'status', value: '已处置', needSelect: true, verb: '处置', entity: '资产' }),
  批量结账: r('setStatus', { field: 'status', value: '已结账', needSelect: true, verb: '结账', entity: '会计期间' }),
  批量申报: r('setStatus', { field: 'status', value: '已申报', needSelect: true, verb: '申报', entity: '税种' }),
  批量重置密码: r('notify', { needSelect: true, tip: '密码已重置为 Cloud@2025' }),
  批量停用: r('setStatus', { field: 'status', value: '停用', needSelect: true, verb: '停用' }),
  批量删除: r('remove', { needSelect: true, danger: true }),
  批量标记已读: r('setStatus', { field: 'read', value: '已读', needSelect: true, verb: '标记已读', entity: '消息' }),
  批量重置: r('custom', { custom: 'resetParam', needSelect: true, tip: '已恢复默认值' }),
  批量同步至账套: r('custom', { custom: 'syncLedger', needSelect: true, tip: '科目已同步至目标账套' }),
}

/**
 * 未登记在表里的动作，按名称关键词兜底推断，避免出现「点了没反应」。
 */
export function inferRule(name: string): ActionRule {
  const n = name.trim()
  // 「批量X」：按 X 的语义推断，再补上 needSelect —— 批量动作必须先勾选行
  if (n.startsWith('批量')) {
    const core = inferCore(n.replace(/^批量/, ''))
    return { ...core, needSelect: true }
  }
  return inferCore(n)
}

function inferCore(n: string): ActionRule {
  if (/导出|打印|下载/.test(n)) return r('export')
  if (/导入|同步|上传/.test(n)) return r('import')
  if (/删除|移除|清空/.test(n)) return r('remove', { danger: true })
  if (/作废|停用|离职/.test(n)) return r('setStatus', { field: 'status', value: '停用' })
  if (/撤回|驳回|拒绝/.test(n)) return r('reject', { field: 'status', value: '已撤回' })
  if (/通过|审核|审批|核销|查验|确认|提交/.test(n)) return r('approve')
  if (/新建|新增|添加|创建|发起|登记|发布|录入|开具|开通|预订/.test(n)) return r('create')
  if (/编辑|修改|调整|配置|更新/.test(n)) return r('edit')
  if (/详情|查看|明细|档案|记录|台账/.test(n)) return r('detail')
  if (/分配|领取|转办|授权/.test(n)) return r('assign')
  if (/提醒|催办|通知|发送|分享/.test(n)) return r('notify')
  if (/预览|设计|策略|拆解|复盘|纪要|简报|调试/.test(n)) return r('preview')
  if (/推进|流转|阶段/.test(n)) return r('advance')
  return r('detail')
}

export function resolveRule(name: string): ActionRule {
  return actionRules[name] ?? inferRule(name)
}

/** 供页面渲染按钮样式：危险操作红色 */
export function isDanger(name: string): boolean {
  return !!actionRules[name]?.danger
}
