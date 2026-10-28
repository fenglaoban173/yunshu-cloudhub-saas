import { int, money, pick, rng, people, cityPool, dateIn, dateTimeIn, pad } from './base'

const companyA = ['启明', '中科智联', '华宇天成', '锐驰', '蓝海', '数联', '智翔', '恒润', '远图', '汇通',
  '星汉', '和畅', '云汇', '金石', '磐石', '未来', '光大', '嘉禾', '天工', '环宇',
  '正泰', '沃德', '朗新', '佳源', '德邦', '康达', '安擎', '迅达', '万佳', '辰光']
const companyB = ['科技有限公司', '信息技术有限公司', '智能制造有限公司', '数据服务有限公司', '供应链管理有限公司',
  '医疗器械有限公司', '教育科技有限公司', '网络科技有限公司', '商业保理有限公司', '实业有限公司']

export const companyNames = companyA.flatMap((a, i) =>
  [0, 1].map((k) => `${cityPool[i % cityPool.length]}${a}${companyB[(i + k) % companyB.length]}`),
)

export const industryPool = [
  '互联网', '智能制造', '金融科技', '医疗健康', '教育培训', '新能源', '物流供应链',
  '零售快消', '文化传媒', '建筑工程', '汽车零部件', '农业食品',
]
export const sourcePool = ['官网表单', '400 电话', '展会', '老客户转介绍', '渠道代理', '广告投放', '陌生拜访', '合作伙伴推荐']
export const stagePool = [
  { key: 's1', name: '需求确认', rate: 10 },
  { key: 's2', name: '方案演示', rate: 30 },
  { key: 's3', name: '方案报价', rate: 50 },
  { key: 's4', name: '商务谈判', rate: 70 },
  { key: 's5', name: '合同签署', rate: 90 },
]
export const levelPool = ['战略客户', '重点客户', '普通客户', '潜在客户', '流失风险']

/* ----------------------------- 线索 ----------------------------- */
export const leads = Array.from({ length: 46 }, (_, i) => {
  const company = pick(companyNames)
  return {
    id: `LD${pad(i + 1, 5)}`,
    name: `${company.slice(0, 2)}${pick(['先生', '女士'])}`,
    company,
    phone: `1${pick(['3', '5', '7', '8'])}${pad(int(10000000, 99999999), 8)}`,
    source: pick(sourcePool),
    industry: pick(industryPool),
    intent: pick(['高', '中', '低']),
    owner: pick(people).name,
    status: pick(['待分配', '跟进中', '已转化', '已废弃']),
    createdAt: dateTimeIn(),
  }
})

/* --------------------------- 线索池 --------------------------- */
export const leadPool = leads.slice(0, 24).map((l, i) => ({
  ...l,
  id: `LP${pad(i + 1, 5)}`,
  status: pick(['待领取', '待分配', '已锁定']),
  lockUntil: `2025-${pad(int(1, 12), 2)}-${pad(int(1, 28), 2)} ${pad(int(18, 23), 2)}:00`,
  grade: pick(['A', 'B', 'C']),
  daysInPool: int(1, 96),
}))

/* ----------------------------- 客户 ----------------------------- */
export const accounts = Array.from({ length: 38 }, (_, i) => {
  const company = companyNames[i % companyNames.length]
  const contractValue = money(12, 860, 2)
  return {
    id: `CU${pad(i + 1, 5)}`,
    name: company,
    industry: pick(industryPool),
    level: pick(levelPool),
    owner: pick(people).name,
    dept: pick(['销售中心', '销售中心', '市场中心', '大客户部']),
    city: pick(cityPool),
    contactCount: int(1, 9),
    contractValue,
    arBalance: money(0, contractValue * 0.6, 2),
    renewalDate: `2026-${pad(int(1, 12), 2)}-${pad(int(1, 28), 2)}`,
    status: pick(['合作中', '合作中', '合作中', '洽谈中', '已流失']),
    createdAt: dateIn(),
  }
})

/* --------------------------- 联系人 --------------------------- */
export const contacts = Array.from({ length: 52 }, (_, i) => ({
  id: `CT${pad(i + 1, 5)}`,
  name: pick(people).name,
  company: pick(companyNames),
  position: pick(['CEO', 'CTO', 'CFO', 'CIO', 'IT 总监', '采购经理', '财务经理', '运营总监', '总经理', '信息化主管']),
  department: pick(['信息中心', '财务部', '采购部', '运营部', '管理层', '信息技术部']),
  phone: `1${pick(['3', '5', '8'])}${pad(int(10000000, 99999999), 8)}`,
  email: `user${pad(i + 1, 3)}@corp.com`,
  isKey: rng() > 0.62 ? '是' : '否',
  owner: pick(people).name,
  lastContact: dateIn(),
}))

/* ----------------------------- 商机 ----------------------------- */
export const opportunities = Array.from({ length: 40 }, (_, i) => {
  const stage = pick(stagePool)
  const amount = money(8, 520, 2)
  return {
    id: `OP${pad(i + 1, 5)}`,
    name: `${pick(companyNames).slice(0, 6)} · ${pick(['CRM 订阅', '财务 SaaS', '一体化平台', '协同办公', '数据中台'])}项目`,
    customer: pick(companyNames),
    owner: pick(people).name,
    stage: stage.name,
    stageRate: stage.rate,
    amount,
    expectedClose: `2025-${pad(int(9, 12), 2)}-${pad(int(1, 28), 2)}`,
    source: pick(sourcePool),
    probability: stage.rate,
    createdAt: dateIn(),
  }
})

/* ----------------------------- 报价 ----------------------------- */
export const quotes = Array.from({ length: 32 }, (_, i) => ({
  id: `QT${pad(i + 1, 5)}`,
  title: `${pick(companyNames).slice(0, 6)} 采购报价单`,
  customer: pick(companyNames),
  version: `V${int(1, 3)}.${int(0, 9)}`,
  amount: money(5, 480, 2),
  validDays: int(7, 30),
  owner: pick(people).name,
  status: pick(['待审核', '已审核', '已生效', '已失效']),
  createdAt: dateIn(),
}))

/* ----------------------------- 合同 ----------------------------- */
export const contracts = Array.from({ length: 36 }, (_, i) => {
  const total = money(10, 760, 2)
  const received = money(total * 0.2, total * 0.95, 2)
  return {
    id: `CT${pad(i + 1, 5)}`,
    title: `${pick(companyNames).slice(0, 6)} 软件服务采购合同`,
    customer: pick(companyNames),
    owner: pick(people).name,
    amount: total,
    received,
    unpaid: +(total - received).toFixed(2),
    signDate: dateIn(),
    startDate: dateIn(),
    endDate: `2026-${pad(int(1, 12), 2)}-${pad(int(1, 28), 2)}`,
    status: pick(['履约中', '履约中', '待签署', '已到期']),
    dept: pick(['销售中心', '大客户部']),
  }
})

/* --------------------------- 回款计划 --------------------------- */
export const receipts = Array.from({ length: 40 }, (_, i) => ({
  id: `RC${pad(i + 1, 5)}`,
  customer: pick(companyNames),
  contract: `CT${pad(int(1, 36), 5)}`,
  period: `2025-Q${int(1, 4)}`,
  planAmount: money(3, 180, 2),
  actualAmount: money(0, 160, 2),
  dueDate: `2025-${pad(int(1, 12), 2)}-${pad(int(1, 28), 2)}`,
  owner: pick(people).name,
  status: pick(['已回款', '待回款', '部分回款', '已逾期']),
}))

/* ----------------------------- 跟进 ----------------------------- */
export const follows = Array.from({ length: 44 }, (_, i) => ({
  id: `FU${pad(i + 1, 5)}`,
  customer: pick(companyNames),
  contact: pick(people).name,
  way: pick(['电话', '微信', '拜访', '视频会议', '邮件']),
  content: pick([
    '已沟通采购预算，客户倾向先上 CRM 模块，财务模块次年续',
    '演示了多租户与数据权限能力，客户技术负责人关注审计日志',
    '客户已提交采购申请，等待集团用印审批',
    '竞品报价低于我方 8%，需准备增值服务方案',
    '已确认实施周期 45 天，要求提供培训与迁移方案',
  ]),
  nextAt: `2025-${pad(int(10, 12), 2)}-${pad(int(1, 28), 2)}`,
  owner: pick(people).name,
  createdAt: dateTimeIn(),
}))

/* ---------------------------- 销售目标 ---------------------------- */
export const targets = Array.from({ length: 30 }, (_, i) => {
  const target = money(80, 900, 2)
  const actual = money(target * 0.3, target * 1.15, 2)
  return {
    id: `TG${pad(i + 1, 5)}`,
    owner: pick(people).name,
    dept: pick(['销售中心', '大客户部', '华东区', '华南区', '华北区']),
    period: `2025-${pad(int(1, 12), 2)}`,
    target,
    actual,
    rate: +((actual / target) * 100).toFixed(1),
    customerCount: int(3, 28),
  }
})

/* ---------------------------- 产品 ---------------------------- */
export const products = [
  { id: 'PD001', name: '云枢 CRM 标准版', category: 'CRM', price: 980, unit: '用户/年', status: '在售', saleCount: int(320, 980) },
  { id: 'PD002', name: '云枢 CRM 企业版', category: 'CRM', price: 2680, unit: '用户/年', status: '在售', saleCount: int(80, 420) },
  { id: 'PD003', name: '智能财税 SaaS 专业版', category: '财务', price: 1580, unit: '账套/年', status: '在售', saleCount: int(120, 560) },
  { id: 'PD004', name: '协同办公 OA 旗舰版', category: 'OA', price: 680, unit: '用户/年', status: '在售', saleCount: int(200, 900) },
  { id: 'PD005', name: '一体化平台 Enterprise', category: '套件', price: 6800, unit: '企业/年', status: '在售', saleCount: int(15, 88) },
  { id: 'PD006', name: '云枢 CRM 基础版', category: 'CRM', price: 480, unit: '用户/年', status: '在售', saleCount: int(400, 1200) },
  { id: 'PD007', name: '报表中心增强包', category: '增值', price: 1200, unit: '企业/年', status: '在售', saleCount: int(30, 260) },
  { id: 'PD008', name: 'AI 智能助手插件', category: '增值', price: 2400, unit: '企业/年', status: '预售', saleCount: int(5, 60) },
]

export const crmOverview = {
  funnel: [
    { stage: '线索', count: 486, amount: 1280 },
    { stage: '商机', count: 218, amount: 964 },
    { stage: '方案', count: 126, amount: 682 },
    { stage: '谈判', count: 58, amount: 410 },
    { stage: '成交', count: 31, amount: 268 },
  ],
  monthly: [
    { m: '1月', target: 320, actual: 286 }, { m: '2月', target: 280, actual: 244 },
    { m: '3月', target: 360, actual: 398 }, { m: '4月', target: 380, actual: 352 },
    { m: '5月', target: 400, actual: 428 }, { m: '6月', target: 420, actual: 396 },
    { m: '7月', target: 440, actual: 471 }, { m: '8月', target: 460, actual: 452 },
    { m: '9月', target: 480, actual: 512 }, { m: '10月', target: 520, actual: 548 },
    { m: '11月', target: 540, actual: 566 }, { m: '12月', target: 620, actual: 694 },
  ],
  source: [
    { name: '官网表单', value: 168 }, { name: '老客户转介绍', value: 132 },
    { name: '展会', value: 96 }, { name: '渠道代理', value: 74 },
    { name: '广告投放', value: 52 }, { name: '陌生拜访', value: 31 },
  ],
}
