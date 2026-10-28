import { int, money, pick, people, cityPool, dateIn, dateTimeIn, pad, deptTree, rng } from './base'

export const flowTypes = ['请假申请', '费用报销', '出差申请', '加班申请', '采购申请', '合同用印', '转正申请', '离职申请', '用章申请', '付款申请']

export const approvals = Array.from({ length: 44 }, (_, i) => {
  // 标题里的申请人必须与 applicant 一致，否则会出现「张三的申请」但来源是李四
  const applicant = pick(people).name
  const type = pick(flowTypes)
  return {
    id: `AP${pad(i + 1, 5)}`,
    title: `${applicant}的${type}`,
    type,
    applicant,
    dept: pick(deptTree),
    amount: money(0.2, 30, 2),
    submitAt: dateTimeIn(),
    currentNode: pick(['部门主管审批', '财务复核', '分管领导审批', '总经理审批', 'HR 备案']),
    duration: `${int(1, 72)} 小时`,
    urgency: pick(['普通', '普通', '加急', '特急']),
    status: pick(['审批中', '审批中', '已通过', '已驳回', '已撤回']),
  }
})

export const todos = approvals.filter((a) => a.status === '审批中').map((a, i) => ({
  ...a,
  id: `TD${pad(i + 1, 5)}`,
  from: `${a.applicant} · ${a.dept}`,
  arriveAt: dateTimeIn(),
  waitHours: int(1, 96),
}))

export const flows = [
  { id: 'FL001', name: '员工请假审批流程', code: 'LEAVE', type: '请假申请', version: 'v3.2', status: '启用', nodeCount: 4, instanceCount: int(120, 980), owner: '陈墨', updatedAt: dateIn() },
  { id: 'FL002', name: '费用报销标准流程', code: 'EXPENSE', type: '费用报销', version: 'v5.0', status: '启用', nodeCount: 6, instanceCount: int(300, 2200), owner: '陈墨', updatedAt: dateIn() },
  { id: 'FL003', name: '采购申请审批流程', code: 'PURCHASE', type: '采购申请', version: 'v2.4', status: '启用', nodeCount: 7, instanceCount: int(60, 460), owner: '林越', updatedAt: dateIn() },
  { id: 'FL004', name: '合同用印审批流程', code: 'SEAL', type: '合同用印', version: 'v4.1', status: '启用', nodeCount: 5, instanceCount: int(40, 320), owner: '林越', updatedAt: dateIn() },
  { id: 'FL005', name: '员工转正审批流程', code: 'REGULAR', type: '转正申请', version: 'v1.8', status: '启用', nodeCount: 3, instanceCount: int(10, 90), owner: '苏念', updatedAt: dateIn() },
  { id: 'FL006', name: '离职交接审批流程', code: 'RESIGN', type: '离职申请', version: 'v2.1', status: '启用', nodeCount: 6, instanceCount: int(8, 76), owner: '苏念', updatedAt: dateIn() },
  { id: 'FL007', name: '付款申请审批流程', code: 'PAYMENT', type: '付款申请', version: 'v3.0', status: '启用', nodeCount: 8, instanceCount: int(120, 860), owner: '陈墨', updatedAt: dateIn() },
  { id: 'FL008', name: '出差申请流程', code: 'TRAVEL', type: '出差申请', version: 'v2.3', status: '停用', nodeCount: 4, instanceCount: int(30, 240), owner: '苏念', updatedAt: dateIn() },
  { id: 'FL009', name: '加班申请流程', code: 'OVERTIME', type: '加班申请', version: 'v1.4', status: '启用', nodeCount: 2, instanceCount: int(60, 420), owner: '苏念', updatedAt: dateIn() },
  { id: 'FL010', name: '固定资产盘点流程', code: 'ASSET', type: '盘点申请', version: 'v1.0', status: '草稿', nodeCount: 3, instanceCount: 0, owner: '林越', updatedAt: dateIn() },
]

export const leaves = Array.from({ length: 40 }, (_, i) => ({
  id: `LV${pad(i + 1, 5)}`,
  applicant: pick(people).name,
  dept: pick(deptTree),
  type: pick(['年假', '事假', '病假', '调休', '婚假', '产假', '育儿假']),
  startDate: dateIn(),
  endDate: dateIn(),
  days: int(0.5, 12),
  reason: pick(['家中有事需处理', '身体不适需就医休息', '年假规划出行', '照顾家人', '办理个人证件', '调休补休']),
  approver: pick(people).name,
  status: pick(['审批中', '已通过', '已驳回']),
  balance: int(0, 18),
}))

export const travels = Array.from({ length: 30 }, (_, i) => ({
  id: `TR${pad(i + 1, 5)}`,
  applicant: pick(people).name,
  dept: pick(['销售中心', '交付服务中心', '研发中心', '市场中心']),
  destination: pick(cityPool),
  startDate: dateIn(),
  endDate: dateIn(),
  days: int(1, 8),
  budget: money(1, 12, 2),
  transport: pick(['飞机', '高铁', '自驾', '大巴']),
  purpose: pick(['客户现场实施', '行业展会', '总部述职', '渠道伙伴拜访', '项目验收']),
  status: pick(['审批中', '已通过', '已驳回', '已报销']),
}))

export const overtimes = Array.from({ length: 34 }, (_, i) => ({
  id: `OT${pad(i + 1, 5)}`,
  applicant: pick(people).name,
  dept: pick(deptTree),
  date: dateIn(),
  startTime: `${pad(int(18, 20), 2)}:00`,
  endTime: `${pad(int(21, 23), 2)}:00`,
  hours: int(1, 5),
  type: pick(['工作日加班', '休息日加班', '法定节假日加班']),
  reason: pick(['版本发布保障', '客户上线支持', '季度结账处理', '投标文件赶制', '系统割接']),
  comp: pick(['调休', '加班费', '调休或加班费']),
  status: pick(['审批中', '已通过', '已驳回']),
}))

export const expenses = Array.from({ length: 42 }, (_, i) => ({
  id: `EX${pad(i + 1, 5)}`,
  title: pick(['客户拜访差旅', '市场活动费用', '办公用品采购', '技术大会参会', '团建费用', '通讯补贴', '交通费用', '客户礼品']),
  applicant: pick(people).name,
  dept: pick(deptTree),
  category: pick(['差旅费', '业务招待费', '办公费', '培训费', '交通费', '业务费']),
  amount: money(0.05, 12, 2),
  invoiceCount: int(0, 6),
  applyDate: dateIn(),
  approver: pick(people).name,
  status: pick(['审批中', '审批中', '已通过', '已驳回', '已支付']),
  paid: pick(['未付款', '已付款', '未付款']),
}))

export const notices = Array.from({ length: 22 }, (_, i) => ({
  id: `NT${pad(i + 1, 5)}`,
  title: pick([
    '关于 2026 年度预算编制工作启动的通知',
    '关于国庆节假期安排的通知',
    '关于新版 CRM 客户 360 视图上线的通知',
    '关于开展信息安全合规培训的通知',
    '关于集团办公区域搬迁的通知',
    '关于第三季度经营分析会议召开的通知',
    '关于差旅报销标准调整的通知',
    '关于年度体检安排的通知',
  ]),
  type: pick(['公告', '通知', '通报']),
  publisher: pick(['集团管理中心', '人力资源中心', '财务中心', '行政部']),
  publishAt: dateTimeIn(),
  readCount: int(12, 486),
  top: rngTop(),
  status: pick(['已发布', '已发布', '草稿']),
}))

function rngTop() {
  return Math.random() > 0.82 ? '是' : '否'
}

export const meetings = Array.from({ length: 26 }, (_, i) => ({
  id: `MT${pad(i + 1, 5)}`,
  subject: pick(['周例会', '项目评审会', '季度经营分析会', '产品需求评审', '客户方案沟通', '技术架构评审', '招聘面试']),
  room: pick(['A301 董事会议室', 'B502 培训室', 'C203 洽谈室', 'D801 视频会议室', 'E101 头脑风暴室']),
  organizer: pick(people).name,
  date: dateIn(),
  time: `${pad(int(8, 18), 2)}:${pick(['00', '30'])}`,
  duration: int(1, 4),
  attendees: int(3, 22),
  status: pick(['待开始', '进行中', '已结束', '已取消']),
  needBooking: pick(['需要', '不需要']),
}))

export const knowledge = Array.from({ length: 30 }, (_, i) => ({
  id: `KN${pad(i + 1, 5)}`,
  title: pick([
    '新员工入职指引（2025版）', '销售标准化话术手册 V3', '产品实施交付规范', '财务核算与结账操作手册',
    '信息安全与数据合规指引', '客户合同评审要点', '远程办公管理办法', 'CRM 数据导入模板说明',
    '项目验收标准与流程', '售后服务 SLA 承诺', '费用报销操作指引', '季度经营分析模板',
  ]),
  category: pick(['制度文件', '产品手册', '销售赋能', '财务指引', '技术文档', '培训资料']),
  author: pick(people).name,
  dept: pick(deptTree),
  updatedAt: dateIn(),
  views: int(12, 1860),
  status: pick(['已发布', '已发布', '草稿', '待审核']),
}))

export const staff = people.slice(0, 40).map((p, i) => ({
  id: p.id,
  name: p.name,
  account: p.account,
  gender: i % 3 === 0 ? '女' : '男',
  dept: pick(deptTree),
  position: pick(['CEO', 'CTO', 'CFO', 'VP 销售', '销售经理', '产品经理', '架构师', '财务经理', 'HRBP', '实施顾问', '客户成功经理']),
  phone: p.phone,
  email: p.account,
  entryDate: dateIn(),
  status: pick(['在职', '在职', '在职', '试用期', '离职']),
  level: pick(['P4', 'P5', 'P6', 'P7', 'P8', 'M1', 'M2']),
  location: pick(cityPool),
}))

export const seals = Array.from({ length: 18 }, (_, i) => ({
  id: `SL${pad(i + 1, 5)}`,
  name: pick(['云枢科技合同专用章', '云枢科技财务专用章', '云枢科技公章', '云枢科技法人章', '销售专用章', '人事专用章']),
  type: pick(['合同专用章', '财务专用章', '公章', '法人章', '业务专用章', '人事专用章']),
  keeper: pick(people).name,
  dept: pick(['法务部', '财务中心', '综合管理部', '销售中心', '人力资源中心']),
  location: pick(['集团总部 A 座', '集团总部 B 座', '上海分公司', '深圳分公司']),
  useCount: int(0, 260),
  lastUsed: dateTimeIn(),
  status: pick(['正常', '正常', '停用', '遗失补办中']),
}))

export const okrs = Array.from({ length: 22 }, (_, i) => {
  const progress = int(15, 100)
  return {
    id: `OK${pad(i + 1, 5)}`,
    objective: pick([
      'Q4 新签合同额突破 1.2 亿元', 'CRM 产品续费率提升至 92%', '交付平均周期压缩至 40 天',
      '人效提升 15%，人均创收突破 80 万', '财务月结从 T+8 提速至 T+3', '客户 NPS 提升至 45 分',
    ]),
    owner: pick(people).name,
    dept: pick(deptTree),
    period: pick(['2025-Q3', '2025-Q4', '2026-Q1']),
    krCount: int(2, 5),
    progress,
    score: int(1, 5),
    status: pick(['进行中', '进行中', '已完成', '有风险']),
  }
})

export const schedules = Array.from({ length: 30 }, (_, i) => ({
  id: `SC${pad(i + 1, 5)}`,
  title: pick(['客户需求确认会', '周例会', '技术方案评审', '年度预算沟通', '员工面试', '产品需求讨论', '季度复盘']),
  date: dateIn(),
  time: `${pad(int(8, 19), 2)}:${pick(['00', '30'])}`,
  duration: int(1, 3),
  type: pick(['会议', '客户拜访', '内部评审', '培训', '面试']),
  location: pick(['A301 董事会议室', '线上腾讯会议', '客户现场', 'B502 培训室']),
  organizer: pick(people).name,
  attendees: int(1, 12),
  remind: pick(['提前15分钟', '提前30分钟', '提前1小时', '不提醒']),
  status: pick(['待开始', '进行中', '已结束']),
}))

/** OA 工作台聚合数据（应用域落地页） */
export const oaOverview = {
  /** 近 7 日全公司审批量 */
  weekly: [
    { d: '周一', passed: 38, pending: 11, rejected: 5 },
    { d: '周二', passed: 46, pending: 14, rejected: 4 },
    { d: '周三', passed: 52, pending: 9, rejected: 3 },
    { d: '周四', passed: 44, pending: 16, rejected: 6 },
    { d: '周五', passed: 61, pending: 12, rejected: 4 },
    { d: '周六', passed: 12, pending: 4, rejected: 1 },
    { d: '周日', passed: 8, pending: 3, rejected: 1 },
  ],
  /** 审批类型分布 */
  types: [
    { name: '费用报销', value: 86 },
    { name: '请假申请', value: 64 },
    { name: '出差申请', value: 48 },
    { name: '采购申请', value: 37 },
    { name: '合同用印', value: 29 },
    { name: '加班申请', value: 22 },
    { name: '付款申请', value: 15 },
  ],
  /** 部门人员规模 */
  deptSize: [
    { name: '研发中心', value: 186 },
    { name: '销售中心', value: 128 },
    { name: '交付服务中心', value: 92 },
    { name: '集团管理中心', value: 42 },
    { name: '市场中心', value: 36 },
    { name: '财务中心', value: 28 },
    { name: '供应链中心', value: 22 },
    { name: '人力资源中心', value: 18 },
  ],
}

/** 考勤日历数据：某员工某月的每日打卡 */
export const attendanceRows = Array.from({ length: 22 }, (_, i) => {
  const day = i + 1
  const weekend = day % 7 === 6 || day % 7 === 0
  const has = !weekend && rng() > 0.12
  return {
    day,
    date: `2025-10-${pad(day, 2)}`,
    week: ['日', '一', '二', '三', '四', '五', '六'][new Date(2025, 9, day).getDay()],
    type: weekend ? '休息' : has ? '正常' : pick(['迟到', '缺卡', '外勤']),
    in: has ? `${pad(int(8, 9), 2)}:${pick(['05', '18', '32', '47'])}` : '—',
    out: has ? `${pad(int(18, 20), 2)}:${pick(['02', '15', '38', '51'])}` : '—',
    hours: has ? +(int(8, 10) + rng() / 10).toFixed(1) : 0,
    overtime: rng() > 0.75 ? +(int(1, 3) + rng()).toFixed(1) : 0,
  }
})
