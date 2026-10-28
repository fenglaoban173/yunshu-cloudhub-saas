import { int, money, pick, people, cityPool, dateIn, dateTimeIn, pad, deptTree } from './base'

export const sysUsers = people.slice(0, 26).map((p, i) => ({
  id: p.id,
  name: p.name,
  account: p.account,
  phone: p.phone,
  dept: pick(deptTree),
  role: pick(['超级管理员', '财务总监', '销售经理', 'HR 经理', '普通员工', '审计员', '只读访客']),
  status: pick(['正常', '正常', '正常', '停用', '锁定']),
  lastLogin: dateTimeIn(),
  createdAt: dateIn(),
  tenant: pick(['云枢科技集团', '云枢科技集团', '深圳子公司', '上海子公司']),
}))

export const roles = [
  { id: 'R001', name: '超级管理员', code: 'SUPER_ADMIN', scope: '全局', users: 3, menus: 268, dataScope: '全部数据', builtin: '是', status: '启用', desc: '系统最高权限，含租户配置与计费' },
  { id: 'R002', name: '集团财务总监', code: 'FINANCE_DIRECTOR', scope: '集团财务', users: 8, menus: 86, dataScope: '本集团全部账套', builtin: '是', status: '启用', desc: '全量财务核算、报表与结账权限' },
  { id: 'R003', name: '销售经理', code: 'SALES_MANAGER', scope: '销售中心', users: 14, menus: 52, dataScope: '本部门及下级', builtin: '否', status: '启用', desc: '商机、合同、报价与团队业绩' },
  { id: 'R004', name: '销售代表', code: 'SALES_REP', scope: '销售中心', users: 62, menus: 31, dataScope: '仅本人', builtin: '否', status: '启用', desc: '线索跟进与本人业绩' },
  { id: 'R005', name: 'HR 经理', code: 'HR_MANAGER', scope: '人力资源中心', users: 5, menus: 64, dataScope: '全公司', builtin: '否', status: '启用', desc: '组织、人事、考勤与招聘' },
  { id: 'R006', name: '普通员工', code: 'EMPLOYEE', scope: '全公司', users: 486, menus: 18, dataScope: '仅本人', builtin: '是', status: '启用', desc: 'OA 日常：审批、请假、报销、公告' },
  { id: 'R007', name: '审计员', code: 'AUDITOR', scope: '全公司', users: 4, menus: 96, dataScope: '全量只读', builtin: '否', status: '启用', desc: '只读查看全部业务与日志' },
  { id: 'R008', name: '财务会计', code: 'ACCOUNTANT', scope: '财务中心', users: 22, menus: 74, dataScope: '指定账套', builtin: '否', status: '启用', desc: '凭证、往来与报表编制' },
  { id: 'R009', name: '出纳', code: 'CASHIER', scope: '财务中心', users: 6, menus: 38, dataScope: '指定账套', builtin: '否', status: '启用', desc: '资金收付与日记账' },
  { id: 'R010', name: '交付项目经理', code: 'DELIVERY_PM', scope: '交付服务中心', users: 28, menus: 47, dataScope: '本部门及下级', builtin: '否', status: '停用', desc: '实施项目与工单管理' },
  { id: 'R011', name: '只读访客', code: 'GUEST', scope: '自定义', users: 11, menus: 9, dataScope: '自定义范围', builtin: '否', status: '启用', desc: '外部客户查看进度' },
  { id: 'R012', name: '系统集成商', code: 'PARTNER', scope: '自定义', users: 9, menus: 22, dataScope: '仅授权客户', builtin: '否', status: '启用', desc: '开放平台 API 调用方' },
]

export const depts = [
  { id: 'D001', name: '云枢科技集团', parent: '—', code: 'CH-GROUP', manager: '陈墨', people: 486, level: 1, costCenter: 'CC-1000', status: '启用', createAt: '2022-03-01' },
  { id: 'D002', name: '集团管理中心', parent: '云枢科技集团', code: 'CH-GM', manager: '林越', people: 42, level: 2, costCenter: 'CC-1100', status: '启用', createAt: '2022-03-01' },
  { id: 'D003', name: '销售中心', parent: '云枢科技集团', code: 'CH-SALES', manager: '苏念', people: 128, level: 2, costCenter: 'CC-2000', status: '启用', createAt: '2022-03-01' },
  { id: 'D004', name: '大客户部', parent: '销售中心', code: 'CH-SALES-KA', manager: '苏念', people: 26, level: 3, costCenter: 'CC-2100', status: '启用', createAt: '2023-05-12' },
  { id: 'D005', name: '华东区', parent: '销售中心', code: 'CH-SALES-EAST', manager: '周云', people: 34, level: 3, costCenter: 'CC-2200', status: '启用', createAt: '2023-05-12' },
  { id: 'D006', name: '华南区', parent: '销售中心', code: 'CH-SALES-SOUTH', manager: '许安', people: 29, level: 3, costCenter: 'CC-2300', status: '启用', createAt: '2023-05-12' },
  { id: 'D007', name: '华北区', parent: '销售中心', code: 'CH-SALES-NORTH', manager: '孟川', people: 25, level: 3, costCenter: 'CC-2400', status: '启用', createAt: '2023-05-12' },
  { id: 'D008', name: '市场中心', parent: '云枢科技集团', code: 'CH-MKT', manager: '孟川', people: 36, level: 2, costCenter: 'CC-3000', status: '启用', createAt: '2022-06-01' },
  { id: 'D009', name: '研发中心', parent: '云枢科技集团', code: 'CH-RD', manager: '沈知白', people: 186, level: 2, costCenter: 'CC-4000', status: '启用', createAt: '2022-03-01' },
  { id: 'D010', name: '交付服务中心', parent: '云枢科技集团', code: 'CH-DEL', manager: '许安', people: 92, level: 2, costCenter: 'CC-5000', status: '启用', createAt: '2022-09-01' },
  { id: 'D011', name: '财务中心', parent: '云枢科技集团', code: 'CH-FIN', manager: '陈墨', people: 28, level: 2, costCenter: 'CC-6000', status: '启用', createAt: '2022-03-01' },
  { id: 'D012', name: '人力资源中心', parent: '云枢科技集团', code: 'CH-HR', manager: '苏念', people: 18, level: 2, costCenter: 'CC-7000', status: '启用', createAt: '2022-03-01' },
  { id: 'D013', name: '供应链中心', parent: '云枢科技集团', code: 'CH-SCM', manager: '周云', people: 22, level: 2, costCenter: 'CC-8000', status: '启用', createAt: '2024-01-08' },
]

export const dicts = [
  { id: 'DC001', name: '客户等级', code: 'CUSTOMER_LEVEL', group: 'CRM', items: 5, creator: '苏念', status: '启用', updateAt: dateIn(), remark: '战略/重点/普通/潜在/流失风险' },
  { id: 'DC002', name: '线索来源', code: 'LEAD_SOURCE', group: 'CRM', items: 8, creator: '苏念', status: '启用', updateAt: dateIn(), remark: '官网表单/展会/转介绍等' },
  { id: 'DC003', name: '商机阶段', code: 'OPP_STAGE', group: 'CRM', items: 5, creator: '孟川', status: '启用', updateAt: dateIn(), remark: '需求确认→合同签署' },
  { id: 'DC004', name: '费用类别', code: 'EXPENSE_TYPE', group: 'OA', items: 12, creator: '陈墨', status: '启用', updateAt: dateIn(), remark: '差旅/招待/办公/培训' },
  { id: 'DC005', name: '审批紧急度', code: 'APPROVE_URGENCY', group: 'OA', items: 4, creator: '苏念', status: '启用', updateAt: dateIn(), remark: '普通/加急/特急' },
  { id: 'DC006', name: '会计科目类型', code: 'ACCOUNT_TYPE', group: '财务', items: 6, creator: '陈墨', status: '启用', updateAt: dateIn(), remark: '资产/负债/权益/损益' },
  { id: 'DC007', name: '币种', code: 'CURRENCY', group: '财务', items: 14, creator: '陈墨', status: '启用', updateAt: dateIn(), remark: 'CNY/USD/HKD/EUR' },
  { id: 'DC008', name: '税率', code: 'TAX_RATE', group: '财务', items: 8, creator: '周云', status: '启用', updateAt: dateIn(), remark: '增值税/附加税/所得税' },
  { id: 'DC009', name: '发票类型', code: 'INVOICE_TYPE', group: '财务', items: 4, creator: '周云', status: '启用', updateAt: dateIn(), remark: '专票/普票/电子专票' },
  { id: 'DC010', name: '岗位序列', code: 'POSITION_SEQ', group: '平台', items: 6, creator: '林越', status: '启用', updateAt: dateIn(), remark: '管理/研发/销售/职能' },
]

export const numberRules = [
  { id: 'NR001', name: '合同编号规则', prefix: 'HT', dateFormat: 'YYYYMMDD', seqLength: 4, sep: '-', sample: 'HT-20251027-0001', scope: 'CRM 合同', status: '启用', owner: '苏念' },
  { id: 'NR002', name: '凭证号规则', prefix: '记', dateFormat: 'YYYYMM', seqLength: 4, sep: '-', sample: '记-202510-0001', scope: '财务凭证', status: '启用', owner: '陈墨' },
  { id: 'NR003', name: '客户编号规则', prefix: 'CU', dateFormat: '', seqLength: 5, sep: '', sample: 'CU00042', scope: 'CRM 客户', status: '启用', owner: '孟川' },
  { id: 'NR004', name: '商机编号规则', prefix: 'OP', dateFormat: '', seqLength: 5, sep: '', sample: 'OP00186', scope: 'CRM 商机', status: '启用', owner: '孟川' },
  { id: 'NR005', name: '报销单编号规则', prefix: 'EX', dateFormat: 'YYYYMM', seqLength: 5, sep: '-', sample: 'EX-202510-00042', scope: 'OA 报销', status: '启用', owner: '陈墨' },
  { id: 'NR006', name: '固定资产卡片号', prefix: 'GD', dateFormat: '', seqLength: 5, sep: '', sample: 'GD00128', scope: '财务资产', status: '启用', owner: '周云' },
  { id: 'NR007', name: '工单编号规则', prefix: 'GD', dateFormat: 'YYYYMMDD', seqLength: 3, sep: '-', sample: 'GD-20251027-001', scope: '服务工单', status: '停用', owner: '许安' },
  { id: 'NR008', name: '员工工号规则', prefix: 'EMP', dateFormat: 'YYYY', seqLength: 4, sep: '', sample: 'EMP0268', scope: '平台员工', status: '启用', owner: '苏念' },
]

export const tenants = [
  { id: 'T001', name: '云枢科技集团', code: 'cloudhub', plan: '旗舰版 Enterprise', users: 486, maxUsers: 1000, storage: '186 GB', domains: 5, expireAt: '2026-12-31', status: '正常', createdAt: '2022-03-01', mr: 386000 },
  { id: 'T002', name: '深圳启明科技', code: 'qiming', plan: '专业版 Professional', users: 86, maxUsers: 100, storage: '42 GB', domains: 1, expireAt: '2026-08-15', status: '正常', createdAt: '2024-01-12', mr: 96000 },
  { id: 'T003', name: '中科智联信息', code: 'zkzl', plan: '专业版 Professional', users: 64, maxUsers: 100, storage: '28 GB', domains: 1, expireAt: '2026-05-20', status: '正常', createdAt: '2024-06-08', mr: 72000 },
  { id: 'T004', name: '华宇天成智造', code: 'hytc', plan: '基础版 Basic', users: 28, maxUsers: 50, storage: '12 GB', domains: 1, expireAt: '2025-12-31', status: '即将到期', createdAt: '2025-01-20', mr: 28000 },
  { id: 'T005', name: '蓝海数据服务', code: 'lanhai', plan: '基础版 Basic', users: 42, maxUsers: 50, storage: '19 GB', domains: 1, expireAt: '2026-03-14', status: '正常', createdAt: '2025-03-14', mr: 34000 },
  { id: 'T006', name: '数联供应链', code: 'sulian', plan: '专业版 Professional', users: 96, maxUsers: 100, storage: '54 GB', domains: 2, expireAt: '2026-10-30', status: '正常', createdAt: '2023-11-02', mr: 108000 },
  { id: 'T007', name: '星汉网络科技', code: 'xinghan', plan: '基础版 Basic', users: 18, maxUsers: 50, storage: '8 GB', domains: 1, expireAt: '2025-11-08', status: '已过期', createdAt: '2024-08-21', mr: 16000 },
]

export const messages = Array.from({ length: 26 }, (_, i) => ({
  id: `MS${pad(i + 1, 5)}`,
  title: pick([
    '您有 3 条待审批事项即将超时', '2025 年 10 月财务结账提醒', '销售目标 Q4 完成度已更新',
    '客户「深圳市启明科技有限公司」合同已到期', '系统升级维护通知（10.28 22:00-24:00）',
    '您的报销单 EX-202510-00042 已通过', '知识库新增《费用报销操作指引》',
  ]),
  type: pick(['审批提醒', '系统公告', '业务提醒', '协作消息']),
  from: pick(['系统', '财务中心', '销售中心', '人力资源中心', 'IT 服务台']),
  sendAt: dateTimeIn(),
  read: pick(['已读', '已读', '未读']),
  priority: pick(['普通', '普通', '重要', '紧急']),
}))

export const opLogs = Array.from({ length: 40 }, (_, i) => ({
  id: `LG${pad(i + 1, 6)}`,
  operator: pick(people).name,
  module: pick(['CRM 客户', 'CRM 商机', 'OA 审批', '财务凭证', '财务账套', '平台用户', '平台角色', '固定资产', '预算管理']),
  action: pick(['新增', '修改', '删除', '审核', '反审核', '导出', '作废', '结账']),
  target: pick(['深圳市启明科技有限公司', '记-0028', '报销单 EX-202510-00042', '角色 R003', '账套 BS001', '固定资产 GD00128']),
  ip: `10.20.${int(1, 60)}.${int(2, 250)}`,
  ua: pick(['Chrome 142 / Windows', 'Edge 141 / Windows', 'Safari 19 / macOS', 'Chrome 142 / macOS']),
  cost: `${int(3, 860)} ms`,
  time: dateTimeIn(),
  result: pick(['成功', '成功', '成功', '失败']),
}))

export const loginLogs = Array.from({ length: 34 }, (_, i) => ({
  id: `IL${pad(i + 1, 6)}`,
  user: pick(people).name,
  account: pick(people).account,
  loginType: pick(['密码登录', '短信验证码', '扫码登录', 'SSO 单点登录']),
  ip: `10.20.${int(1, 60)}.${int(2, 250)}`,
  location: pick(cityPool),
  device: pick(['Windows / Chrome', 'macOS / Safari', 'iOS / App', 'Android / App', 'Windows / Edge']),
  time: dateTimeIn(),
  result: pick(['成功', '成功', '成功', '成功', '失败']),
  failReason: '—',
}))

/** 平台工作台聚合数据（应用域落地页） */
export const platformOverview = {
  /** 近 7 日登录趋势 */
  weekly: [
    { d: '周一', success: 1186, fail: 32 },
    { d: '周二', success: 1242, fail: 26 },
    { d: '周三', success: 1308, fail: 18 },
    { d: '周四', success: 1256, fail: 21 },
    { d: '周五', success: 1432, fail: 15 },
    { d: '周六', success: 486, fail: 8 },
    { d: '周日', success: 392, fail: 6 },
  ],
  /** 租户套餐分布 */
  plans: [
    { name: '旗舰版 Enterprise', value: 1 },
    { name: '专业版 Professional', value: 3 },
    { name: '基础版 Basic', value: 3 },
  ],
  /** 平台用户状态分布 */
  userStatus: [
    { name: '正常', value: 468 },
    { name: '停用', value: 12 },
    { name: '锁定', value: 6 },
  ],
  /** 平台服务健康度 */
  health: [
    { name: 'API 网关', v: '99.98%', p: 99 },
    { name: '认证服务', v: '99.99%', p: 100 },
    { name: '配置中心', v: '99.95%', p: 99 },
    { name: '消息服务', v: '99.92%', p: 98 },
    { name: '文件存储', v: '99.99%', p: 100 },
  ],
}

export const configs = [
  { id: 'CF001', group: '租户', key: 'tenant.default_plan', name: '默认开通套餐', value: '专业版 Professional', type: '下拉', editable: '是', updateAt: dateIn(), operator: '系统' },
  { id: 'CF002', group: '租户', key: 'tenant.max_users', name: '单租户最大用户数', value: '1000', type: '数字', editable: '是', updateAt: dateIn(), operator: '系统' },
  { id: 'CF003', group: '安全', key: 'security.login_fail_lock', name: '登录失败锁定次数', value: '5', type: '数字', editable: '是', updateAt: dateIn(), operator: '林越' },
  { id: 'CF004', group: '安全', key: 'security.password_expire_days', name: '密码有效期（天）', value: '90', type: '数字', editable: '是', updateAt: dateIn(), operator: '林越' },
  { id: 'CF005', group: '安全', key: 'security.sso_enabled', name: '启用企业 SSO', value: 'true', type: '开关', editable: '是', updateAt: dateIn(), operator: '林越' },
  { id: 'CF006', group: '财务', key: 'fin.voucher_auto_generate', name: '业务单据自动生成凭证', value: 'true', type: '开关', editable: '是', updateAt: dateIn(), operator: '陈墨' },
  { id: 'CF007', group: '财务', key: 'fin.close_day', name: '月结截止日', value: '25', type: '数字', editable: '是', updateAt: dateIn(), operator: '陈墨' },
  { id: 'CF008', group: '财务', key: 'fin.currency_default', name: '默认记账本位币', value: 'CNY', type: '下拉', editable: '是', updateAt: dateIn(), operator: '陈墨' },
  { id: 'CF009', group: 'CRM', key: 'crm.lead_recycle_days', name: '线索超时回收天数', value: '30', type: '数字', editable: '是', updateAt: dateIn(), operator: '苏念' },
  { id: 'CF010', group: 'CRM', key: 'crm.opportunity_auto_rate', name: '商机阶段自动赢率', value: 'true', type: '开关', editable: '是', updateAt: dateIn(), operator: '孟川' },
  { id: 'CF011', group: 'OA', key: 'oa.approver_timeout_hours', name: '审批超时小时数', value: '48', type: '数字', editable: '是', updateAt: dateIn(), operator: '苏念' },
  { id: 'CF012', group: 'OA', key: 'oa.auto_upgrade', name: '超时自动升级上级', value: 'true', type: '开关', editable: '是', updateAt: dateIn(), operator: '苏念' },
  { id: 'CF013', group: '消息', key: 'notify.dingtalk_enabled', name: '启用钉钉通知', value: 'true', type: '开关', editable: '是', updateAt: dateIn(), operator: '系统' },
  { id: 'CF014', group: '消息', key: 'notify.wecom_enabled', name: '启用企业微信通知', value: 'false', type: '开关', editable: '是', updateAt: dateIn(), operator: '系统' },
]
