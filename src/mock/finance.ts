import { int, money, pick, people, cityPool, dateIn, pad } from './base'

/* ---------------------------- 账套 ---------------------------- */
export const booksets = [
  { id: 'BS001', name: '云枢科技集团本部账套', entity: '云枢科技（集团）有限公司', currency: 'CNY', taxNo: '91110108MA01ABCD2X', bookType: '企业会计准则', period: '2025-10', status: '使用中', open: '2025-01-01', owner: '陈墨', companyCount: 1 },
  { id: 'BS002', name: '云枢上海分公司账套', entity: '云枢科技（上海）有限公司', currency: 'CNY', taxNo: '91310115MA1K3XYQ7B', bookType: '企业会计准则', period: '2025-09', status: '使用中', open: '2024-07-01', owner: '周云', companyCount: 1 },
  { id: 'BS003', name: '云枢深圳研发中心账套', entity: '云枢科技（深圳）有限公司', currency: 'CNY', taxNo: '91440300MA5FH8P21K', bookType: '小企业会计准则', period: '2025-10', status: '使用中', open: '2023-04-01', owner: '林越', companyCount: 1 },
  { id: 'BS004', name: '云枢服务外包主体账套', entity: '云枢数字服务（苏州）有限公司', currency: 'CNY', taxNo: '91320594MA1MN6RT4C', bookType: '小企业会计准则', period: '2025-06', status: '停用', open: '2022-03-01', owner: '周云', companyCount: 1 },
  { id: 'BS005', name: '海外业务账套（USD）', entity: 'CloudHub International Pte. Ltd.', currency: 'USD', taxNo: 'SG-2023-998201', bookType: 'IFRS', period: '2025-08', status: '使用中', open: '2023-01-01', owner: '陈墨', companyCount: 1 },
]

/* ---------------------------- 科目 ---------------------------- */
const accTree: { code: string; name: string; type: string; dir: string; parent: string; level: number }[] = [
  { code: '1001', name: '库存现金', type: '资产', dir: '借', parent: '1000', level: 2 },
  { code: '1002', name: '银行存款', type: '资产', dir: '借', parent: '1000', level: 2 },
  { code: '1012', name: '其他货币资金', type: '资产', dir: '借', parent: '1000', level: 2 },
  { code: '1122', name: '应收账款', type: '资产', dir: '借', parent: '1100', level: 2 },
  { code: '1123', name: '预付账款', type: '资产', dir: '借', parent: '1100', level: 2 },
  { code: '1221', name: '其他应收款', type: '资产', dir: '借', parent: '1200', level: 2 },
  { code: '1405', name: '库存商品', type: '资产', dir: '借', parent: '1400', level: 2 },
  { code: '1601', name: '固定资产', type: '资产', dir: '借', parent: '1600', level: 2 },
  { code: '1602', name: '累计折旧', type: '资产', dir: '贷', parent: '1600', level: 2 },
  { code: '1701', name: '无形资产', type: '资产', dir: '借', parent: '1700', level: 2 },
  { code: '1801', name: '长期待摊费用', type: '资产', dir: '借', parent: '1800', level: 2 },
  { code: '2001', name: '短期借款', type: '负债', dir: '贷', parent: '2000', level: 2 },
  { code: '2202', name: '应付账款', type: '负债', dir: '贷', parent: '2200', level: 2 },
  { code: '2203', name: '预收账款', type: '负债', dir: '贷', parent: '2200', level: 2 },
  { code: '2211', name: '应付职工薪酬', type: '负债', dir: '贷', parent: '2200', level: 2 },
  { code: '2221', name: '应交税费', type: '负债', dir: '贷', parent: '2200', level: 2 },
  { code: '2241', name: '其他应付款', type: '负债', dir: '贷', parent: '2200', level: 2 },
  { code: '2501', name: '长期借款', type: '负债', dir: '贷', parent: '2500', level: 2 },
  { code: '4001', name: '实收资本', type: '权益', dir: '贷', parent: '4000', level: 2 },
  { code: '4002', name: '资本公积', type: '权益', dir: '贷', parent: '4000', level: 2 },
  { code: '4101', name: '盈余公积', type: '权益', dir: '贷', parent: '4100', level: 2 },
  { code: '4104', name: '利润分配', type: '权益', dir: '贷', parent: '4100', level: 2 },
  { code: '6001', name: '主营业务收入', type: '损益', dir: '贷', parent: '6000', level: 2 },
  { code: '6051', name: '其他业务收入', type: '损益', dir: '贷', parent: '6000', level: 2 },
  { code: '6401', name: '主营业务成本', type: '损益', dir: '借', parent: '6400', level: 2 },
  { code: '6601', name: '销售费用', type: '损益', dir: '借', parent: '6600', level: 2 },
  { code: '6602', name: '管理费用', type: '损益', dir: '借', parent: '6600', level: 2 },
  { code: '6603', name: '财务费用', type: '损益', dir: '借', parent: '6600', level: 2 },
  { code: '6604', name: '研发费用', type: '损益', dir: '借', parent: '6600', level: 2 },
  { code: '6801', name: '所得税费用', type: '损益', dir: '借', parent: '6800', level: 2 },
]

export const finAccounts = [
  { code: '1000', name: '货币资金', type: '资产', dir: '借', parent: '—', level: 1, subCount: 3, enabled: true, creator: '系统预置', createdAt: '2023-01-01', remark: '现金及银行存款' },
  { code: '1100', name: '交易性金融资产', type: '资产', dir: '借', parent: '—', level: 1, subCount: 0, enabled: true, creator: '系统预置', createdAt: '2023-01-01', remark: '' },
  { code: '1400', name: '存货', type: '资产', dir: '借', parent: '—', level: 1, subCount: 1, enabled: true, creator: '系统预置', createdAt: '2023-01-01', remark: '' },
  { code: '1600', name: '固定资产', type: '资产', dir: '借', parent: '—', level: 1, subCount: 2, enabled: true, creator: '系统预置', createdAt: '2023-01-01', remark: '' },
  { code: '2200', name: '流动负债', type: '负债', dir: '贷', parent: '—', level: 1, subCount: 5, enabled: true, creator: '系统预置', createdAt: '2023-01-01', remark: '' },
  { code: '4000', name: '实收资本及资本公积', type: '权益', dir: '贷', parent: '—', level: 1, subCount: 2, enabled: true, creator: '系统预置', createdAt: '2023-01-01', remark: '' },
  { code: '6000', name: '主营业务收入', type: '损益', dir: '贷', parent: '—', level: 1, subCount: 2, enabled: true, creator: '系统预置', createdAt: '2023-01-01', remark: '' },
  { code: '6400', name: '营业成本', type: '损益', dir: '借', parent: '—', level: 1, subCount: 1, enabled: true, creator: '系统预置', createdAt: '2023-01-01', remark: '' },
  { code: '6600', name: '期间费用', type: '损益', dir: '借', parent: '—', level: 1, subCount: 4, enabled: true, creator: '系统预置', createdAt: '2023-01-01', remark: '' },
  ...accTree.map((a, i) => ({
    ...a,
    subCount: 0,
    enabled: i % 5 !== 0,
    creator: pick(['系统预置', '陈墨', '周云']),
    createdAt: dateIn(),
    remark: pick(['', '需二级明细核算', '辅助核算：客户', '辅助核算：部门', '外币核算']),
  })),
].map((a) => ({ ...a, status: a.enabled ? '启用' : '停用' }))

/* ---------------------------- 凭证 ---------------------------- */
export const vouchers = Array.from({ length: 38 }, (_, i) => {
  const debit = money(0.2, 86, 2)
  return {
    id: `VC${pad(i + 1, 5)}`,
    code: `记-${pad(i + 1, 4)}`,
    period: `2025-${pad(int(1, 10), 2)}`,
    date: dateIn(),
    bookset: pick(['云枢科技集团本部账套', '云枢上海分公司账套', '云枢深圳研发中心账套', '海外业务账套（USD）']),
    words: pick(['销售产品', '收到货款', '报销差旅费', '支付供应商货款', '计提工资', '缴纳社保', '结转成本', '支付房租', '收到退款', '计提折旧']),
    source: pick(['手工录入', '业务单据', '期初导入', '月末结转']),
    debit,
    credit: debit,
    count: int(2, 9),
    owner: pick(people).name,
    status: pick(['已审核', '已审核', '已记账', '待审核']),
  }
})

export const voucherEntries = [
  { id: 1, summary: '销售产品', account: '1001 库存现金', debit: 120000, credit: 0, aux: '基本户/中信银行' },
  { id: 2, summary: '销售产品', account: '6001 主营业务收入', debit: 0, credit: 100000, aux: '云枢科技集团本部' },
  { id: 3, summary: '销售产品', account: '2221 应交税费', debit: 0, credit: 20000, aux: '增值税销项' },
  { id: 4, summary: '支付货款', account: '2202 应付账款', debit: 86000, credit: 0, aux: '深圳市启明科技有限公司' },
  { id: 5, summary: '支付货款', account: '1002 银行存款', debit: 0, credit: 86000, aux: '基本户/中信银行' },
  { id: 6, summary: '计提工资', account: '6602 管理费用', debit: 152000, credit: 0, aux: '研发部' },
  { id: 7, summary: '计提工资', account: '2211 应付职工薪酬', debit: 0, credit: 152000, aux: '工资' },
]

/* ---------------------------- 总账 ---------------------------- */
export const glEntries = Array.from({ length: 30 }, (_, i) => {
  const dir = pick(['借', '贷'])
  const debit = dir === '借' ? money(0.5, 90, 2) : 0
  const credit = dir === '贷' ? money(0.5, 90, 2) : 0
  return {
    id: `JE${pad(i + 1, 5)}`,
    period: `2025-${pad(int(1, 10), 2)}`,
    date: dateIn(),
    voucherCode: `记-${pad(int(1, 38), 4)}`,
    summary: pick(['销售产品', '收到货款', '报销差旅费', '支付供应商货款', '计提工资', '缴纳社保', '结转成本', '支付房租']),
    account: pick(['1002 银行存款', '1122 应收账款', '2202 应付账款', '6001 主营业务收入', '6401 主营业务成本', '6602 管理费用', '6601 销售费用', '2221 应交税费']),
    direction: dir,
    debit,
    credit,
    balance: money(10, 3000, 2),
    aux: pick(['—', '深圳市启明科技有限公司', '研发部', '增值税销项']),
  }
})

/* ---------------------------- 应收 ---------------------------- */
export const ar = Array.from({ length: 32 }, (_, i) => {
  const total = money(5, 320, 2)
  const received = money(total * 0.1, total * 0.98, 2)
  return {
    id: `AR${pad(i + 1, 5)}`,
    customer: pick([
      '深圳市启明科技有限公司', '北京中科智联信息科技', '上海华宇天成智能制造', '杭州蓝海数据服务',
      '成都数联供应链管理', '广州星汉网络科技', '武汉云汇商业保理', '西安汇通医疗器械',
    ]),
    contract: `CT${pad(int(1, 36), 5)}`,
    period: `2025-Q${int(1, 4)}`,
    total,
    received,
    balance: +(total - received).toFixed(2),
    dueDate: `2025-${pad(int(1, 12), 2)}-${pad(int(1, 28), 2)}`,
    owner: pick(people).name,
    ageDays: int(3, 240),
    status: pick(['未到期', '未到期', '已逾期', '部分核销']),
  }
})

/* ---------------------------- 应付 ---------------------------- */
export const ap = Array.from({ length: 28 }, (_, i) => {
  const total = money(3, 240, 2)
  const paid = money(total * 0.1, total * 0.95, 2)
  return {
    id: `AP${pad(i + 1, 5)}`,
    supplier: pick([
      '杭州锐驰云计算有限公司', '北京华宇天成技术', '上海数联信息服务', '深圳金石人力资源',
      '广州明达办公用品', '成都未来智能设备', '苏州恒润软件外包',
    ]),
    contract: `HT${pad(int(1, 36), 5)}`,
    category: pick(['软件采购', '云资源', '外包服务', '办公物资', '市场推广', '差旅平台']),
    total,
    paid,
    balance: +(total - paid).toFixed(2),
    dueDate: `2025-${pad(int(1, 12), 2)}-${pad(int(1, 28), 2)}`,
    status: pick(['未到期', '待付款', '已逾期', '部分付款']),
  }
})

/* ---------------------------- 发票 ---------------------------- */
export const invoices = Array.from({ length: 34 }, (_, i) => ({
  id: `IN${pad(i + 1, 5)}`,
  code: `0${int(1000000, 9999999)}`,
  number: `${pad(int(10000000, 99999999), 8)}`,
  type: pick(['增值税专用发票', '增值税普通发票', '电子专用发票', '电子普通发票']),
  direction: pick(['销项', '进项']),
  party: pick(companyPool()),
  taxNo: `91${pick(['3101', '4403', '3301', '5101', '3205'])}${pad(int(100000000, 999999999), 9)}X`,
  amount: money(0.5, 68, 2),
  tax: money(0.02, 3.6, 2),
  total: money(0.5, 72, 2),
  date: dateIn(),
  status: pick(['已认证', '已开具', '待认证', '已作废', '查验通过']),
}))

function companyPool() {
  return [
    '深圳市启明科技有限公司', '北京中科智联信息科技', '上海华宇天成智能制造', '杭州蓝海数据服务',
    '成都数联供应链管理', '广州星汉网络科技', '武汉云汇商业保理', '西安汇通医疗器械',
  ]
}

/* ---------------------------- 银行 ---------------------------- */
export const banks = [
  { id: 'BK001', name: '中国银行·基本户', bank: '中国银行北京分行', account: '1039 5678 9012 3456', currency: 'CNY', balance: 4862300.55, type: '基本户', owner: '陈墨', status: '正常', reconcile: '2025-10-26' },
  { id: 'BK002', name: '招商银行·一般户', bank: '招商银行上海分行', account: '1219 0456 7890 1234', currency: 'CNY', balance: 2340180.20, type: '一般户', owner: '周云', status: '正常', reconcile: '2025-10-25' },
  { id: 'BK003', name: '建设银行·一般户', bank: '建设银行深圳分行', account: '3456 7890 1234 5678', currency: 'CNY', balance: 896420.00, type: '一般户', owner: '林越', status: '正常', reconcile: '2025-10-20' },
  { id: 'BK004', name: '工商银行·外币户', bank: '工商银行深圳分行', account: '4567 8901 2345 6789', currency: 'USD', balance: 128640.35, type: '外币户', owner: '陈墨', status: '正常', reconcile: '2025-10-11' },
  { id: 'BK005', name: '浦发银行·一般户', bank: '浦发银行北京分行', account: '5678 9012 3456 7890', currency: 'CNY', balance: 0.00, type: '一般户', owner: '周云', status: '已注销', reconcile: '—' },
]

export const bankFlows = Array.from({ length: 40 }, (_, i) => {
  const isIn = rngBool()
  const amount = money(0.2, 48, 2)
  return {
    id: `BF${pad(i + 1, 5)}`,
    date: dateIn(),
    account: pick(banks).account,
    direction: isIn ? '收入' : '支出',
    amount,
    balance: money(20, 4800, 2),
    counterparty: pick([
      '深圳市启明科技有限公司', '深圳市云枢科技有限公司', '中国银行手续费', '代发工资', '深圳市明达办公用品',
      '上海数联信息服务有限公司', '结转上年利润',
    ]),
    summary: pick(['货款', '服务费', '工资发放', '手续费', '报销款', '退款', '利息']),
    voucher: rngBool() ? `记-${pad(int(1, 38), 4)}` : '—',
    reconciled: rngBool() ? '是' : '否',
  }
})

function rngBool() {
  return Math.random() > 0.5
}

export const recons = Array.from({ length: 20 }, (_, i) => ({
  id: `RC${pad(i + 1, 5)}`,
  account: pick(banks).name,
  period: `2025-${pad(int(1, 10), 2)}`,
  startDate: `2025-${pad(int(1, 10), 2)}-01`,
  endDate: `2025-${pad(int(1, 10), 2)}-28`,
  bookBalance: money(50, 4800, 2),
  bankBalance: money(50, 4800, 2),
  diff: money(0, 6, 2),
  unmatched: int(0, 14),
  status: pick(['已对账', '对账中', '有差异', '未对账']),
  owner: pick(['陈墨', '周云', '林越']),
}))

/* ---------------------------- 固定资产 ---------------------------- */
export const assets = Array.from({ length: 30 }, (_, i) => {
  const original = money(0.5, 60, 2)
  const acc = +(original * (0.1 + Math.random() * 0.6)).toFixed(2)
  return {
    id: `FA${pad(i + 1, 5)}`,
    code: `GD${pad(i + 1, 5)}`,
    name: pick([
      'MacBook Pro 16"', 'Dell 服务器 R750', '联想台式工作站', '会议一体机', '华为交换机',
      '中央空调机组', '办公桌椅套装', '海尔冰箱', '格力空调', '投影仪',
    ]),
    category: pick(['电子设备', '房屋建筑物', '办公家具', '运输工具', '机器设备', '软件资产']),
    dept: pick(['研发中心', '销售中心', '财务中心', '集团管理中心', '交付服务中心']),
    original,
    accumulated: acc,
    net: +(original - acc).toFixed(2),
    life: int(3, 20),
    method: pick(['年限平均法', '双倍余额递减法', '年数总和法', '工作量法']),
    inDate: dateIn(),
    status: pick(['在用', '在用', '在用', '闲置', '已处置']),
    location: pick(['集团总部 A 座', '集团总部 B 座', '上海分公司', '深圳研发中心']),
  }
})

/* ---------------------------- 预算 ---------------------------- */
export const budgets = Array.from({ length: 26 }, (_, i) => {
  const total = money(20, 600, 2)
  const used = money(total * 0.2, total * 1.05, 2)
  return {
    id: `BG${pad(i + 1, 5)}`,
    subject: pick(['市场推广费', '差旅费', '研发投入', '服务器采购', '人力资源', '培训发展', '办公场地', '销售佣金', '差旅补贴']),
    dept: pick(['市场中心', '销售中心', '研发中心', '集团管理中心', '人力资源中心']),
    period: pick(['2025-Q3', '2025-Q4', '2025年度']),
    total,
    used,
    remain: +(total - used).toFixed(2),
    rate: +((used / total) * 100).toFixed(1),
    status: used > total ? '超支' : used > total * 0.85 ? '预警' : '正常',
    owner: pick(people).name,
  }
})

/* ---------------------------- 结账 ---------------------------- */
export const closes = Array.from({ length: 14 }, (_, i) => ({
  id: `CL${pad(i + 1, 5)}`,
  period: `2025-${pad(int(1, 10), 2)}`,
  endDate: `2025-${pad(int(1, 10), 2)}-28`,
  steps: [
    { name: '业务单据截止', done: true },
    { name: '往来对账完成', done: true },
    { name: '固定资产折旧计提', done: true },
    { name: '收入成本结转', done: true },
    { name: '试算平衡校验', done: true },
    { name: '结账锁定', done: false },
  ],
  vouchers: int(120, 860),
  debit: money(200, 4800, 2),
  credit: money(200, 4800, 2),
  owner: pick(['陈墨', '周云']),
  status: pick(['已结账', '结账中', '未结账', '已结账']),
}))

/* ---------------------------- 出纳 ---------------------------- */
export const cashier = Array.from({ length: 28 }, (_, i) => {
  const isIn = rngBool()
  const amount = money(0.05, 20, 2)
  return {
    id: `CS${pad(i + 1, 5)}`,
    date: dateIn(),
    account: pick(['库存现金', '银行存款-中行基本户', '银行存款-招行一般户']),
    direction: isIn ? '收入' : '支出',
    amount,
    balance: money(1, 300, 2),
    summary: pick(['销售收款', '备用金支取', '费用报销', '银行提现', '零星收入', '缴纳水电']),
    counterparty: pick(companyPool()),
    voucher: `记-${pad(int(1, 38), 4)}`,
    cashier: pick(['周云', '林越']),
  }
})

/* ---------------------------- 税务 ---------------------------- */
export const taxes = Array.from({ length: 18 }, (_, i) => ({
  id: `TX${pad(i + 1, 5)}`,
  type: pick(['增值税', '企业所得税预缴', '附加税费', '印花税', '代扣代缴个人所得税', '房产税', '残保金']),
  period: pick(['2025-07', '2025-08', '2025-09', '2025-10']),
  entity: pick(['云枢科技（集团）有限公司', '云枢科技（上海）有限公司', '云枢科技（深圳）有限公司']),
  taxBase: money(50, 2000, 2),
  rate: pick(['6%', '13%', '25%', '7%', '10%', '0.1%', '万分之五']),
  taxAmount: money(0.5, 120, 2),
  dueDate: `2025-${pad(int(1, 12), 2)}-15`,
  status: pick(['待申报', '已申报', '已缴款', '已作废']),
  owner: pick(['陈墨', '周云']),
}))

/* ------------------------ 财务报表数据 ------------------------ */
/** 报表行：sum=小计行，total=合计行，group=分组标题行 */
export interface ReportRow {
  name: string
  line: number
  current: number
  prior: number
  sum?: boolean
  total?: boolean
  group?: boolean
}

export const balanceSheet: {
  assets: ReportRow[]
  liabilities: ReportRow[]
  equity: ReportRow[]
} = {
  assets: [
    { name: '货币资金', line: 1, current: 8095130.10, prior: 6420380.55 },
    { name: '交易性金融资产', line: 2, current: 1200000.00, prior: 900000.00 },
    { name: '应收账款', line: 3, current: 6432160.40, prior: 5120480.00 },
    { name: '预付款项', line: 4, current: 286400.00, prior: 214600.00 },
    { name: '其他应收款', line: 5, current: 412380.55, prior: 386220.10 },
    { name: '存货', line: 6, current: 0.00, prior: 0.00 },
    { name: '流动资产合计', line: 7, current: 16426071.05, prior: 13041680.65, sum: true },
    { name: '固定资产', line: 8, current: 3268140.00, prior: 3486220.00 },
    { name: '无形资产', line: 9, current: 1860240.00, prior: 1760240.00 },
    { name: '长期待摊费用', line: 10, current: 320000.00, prior: 412000.00 },
    { name: '非流动资产合计', line: 11, current: 5448380.00, prior: 5658460.00, sum: true },
    { name: '资产总计', line: 12, current: 21874451.05, prior: 18700140.65, total: true },
  ],
  liabilities: [
    { name: '短期借款', line: 1, current: 1200000.00, prior: 1800000.00 },
    { name: '应付账款', line: 2, current: 3468210.60, prior: 2860400.00 },
    { name: '预收款项', line: 3, current: 1286400.00, prior: 964200.00 },
    { name: '应付职工薪酬', line: 4, current: 986420.00, prior: 912600.00 },
    { name: '应交税费', line: 5, current: 642180.40, prior: 512340.00 },
    { name: '其他应付款', line: 6, current: 214600.00, prior: 186420.00 },
    { name: '流动负债合计', line: 7, current: 7797811.00, prior: 7235960.00, sum: true },
    { name: '长期借款', line: 8, current: 2000000.00, prior: 2400000.00 },
    { name: '负债合计', line: 9, current: 9797811.00, prior: 9635960.00, total: true },
  ],
  equity: [
    { name: '实收资本', line: 1, current: 8000000.00, prior: 8000000.00 },
    { name: '资本公积', line: 2, current: 1200000.00, prior: 1200000.00 },
    { name: '盈余公积', line: 3, current: 640000.00, prior: 560000.00 },
    { name: '未分配利润', line: 4, current: 2276640.05, prior: 904180.65 },
    { name: '所有者权益合计', line: 5, current: 12076640.05, prior: 10664180.65, total: true },
    { name: '负债和所有者权益总计', line: 6, current: 21874451.05, prior: 18700140.65, total: true },
  ],
}

export const incomeStatement: ReportRow[] = [
  { name: '一、营业收入', line: 1, current: 28462900.00, prior: 21640800.00 },
  { name: '减：营业成本', line: 2, current: 8642140.00, prior: 6420800.00 },
  { name: '二、毛利', line: 3, current: 19820760.00, prior: 15220000.00, sum: true },
  { name: '减：税金及附加', line: 4, current: 286420.00, prior: 214600.00 },
  { name: '减：销售费用', line: 5, current: 6240860.00, prior: 4862000.00 },
  { name: '减：管理费用', line: 6, current: 4821400.00, prior: 4108000.00 },
  { name: '减：研发费用', line: 7, current: 7268400.00, prior: 5846000.00 },
  { name: '减：财务费用', line: 8, current: 286400.00, prior: 312600.00 },
  { name: '三、营业利润', line: 9, current: 1039500.00, prior: -140200.00, sum: true },
  { name: '加：营业外收入', line: 10, current: 86420.00, prior: 42600.00 },
  { name: '减：营业外支出', line: 11, current: 38640.00, prior: 24800.00 },
  { name: '四、利润总额', line: 12, current: 1087280.00, prior: -122400.00, sum: true },
  { name: '减：所得税费用', line: 13, current: 271820.00, prior: 0.00 },
  { name: '五、净利润', line: 14, current: 815460.00, prior: -122400.00, total: true },
]

export const cashFlow: ReportRow[] = [
  { name: '一、经营活动产生的现金流量', line: 1, current: 2864200.00, prior: 1642800.00, group: true },
  { name: '销售商品、提供劳务收到的现金', line: 2, current: 24862900.00, prior: 19280400.00 },
  { name: '收到的税费返还', line: 3, current: 286400.00, prior: 214600.00 },
  { name: '购买商品、接受劳务支付的现金', line: 4, current: -6240860.00, prior: -4862000.00 },
  { name: '支付给职工以及为职工支付的现金', line: 5, current: -8642140.00, prior: -7420800.00 },
  { name: '支付的各项税费', line: 6, current: -1420600.00, prior: -1086400.00 },
  { name: '二、投资活动产生的现金流量', line: 7, current: -6240800.00, prior: -4821400.00, group: true },
  { name: '购建固定资产等支付的现金', line: 8, current: -1862400.00, prior: -1420600.00 },
  { name: '投资支付的现金', line: 9, current: -3200000.00, prior: -2400000.00 },
  { name: '三、筹资活动产生的现金流量', line: 10, current: 2846200.00, prior: 1642000.00, group: true },
  { name: '取得借款收到的现金', line: 11, current: 3200000.00, prior: 2400000.00 },
  { name: '偿还债务支付的现金', line: 12, current: -2800000.00, prior: -1600000.00 },
  { name: '四、现金及现金等价物净增加额', line: 13, current: -530000.00, prior: -1537400.00, total: true },
  { name: '期末现金及现金等价物余额', line: 14, current: 8095130.10, prior: 6420380.55, total: true },
]

export const financeOverview = {
  trend: [
    { m: '1月', income: 1862, cost: 542, profit: 1320 }, { m: '2月', income: 1642, cost: 486, profit: 1156 },
    { m: '3月', income: 2486, cost: 742, profit: 1744 }, { m: '4月', income: 2286, cost: 682, profit: 1604 },
    { m: '5月', income: 2684, cost: 812, profit: 1872 }, { m: '6月', income: 2482, cost: 748, profit: 1734 },
    { m: '7月', income: 2864, cost: 864, profit: 2000 }, { m: '8月', income: 2742, cost: 826, profit: 1916 },
    { m: '9月', income: 2962, cost: 892, profit: 2070 }, { m: '10月', income: 3148, cost: 946, profit: 2202 },
    { m: '11月', income: 3286, cost: 984, profit: 2302 }, { m: '12月', income: 3624, cost: 1086, profit: 2538 },
  ],
  structure: [
    { name: '主营业务收入', value: 2642 },
    { name: '其他业务收入', value: 386 },
    { name: '技术服务收入', value: 214 },
    { name: '运维服务收入', value: 168 },
  ],
  costStructure: [
    { name: '研发费用', value: 7268400 },
    { name: '销售费用', value: 6240860 },
    { name: '管理费用', value: 4821400 },
    { name: '营业成本', value: 8642140 },
  ],
}
