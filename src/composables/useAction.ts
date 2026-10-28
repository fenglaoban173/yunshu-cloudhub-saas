import { message } from 'ant-design-vue'
import { useRouter } from 'vue-router'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import { useUserStore } from '@/stores/user'
import { pages } from '@/mock/pages'
import { people } from '@/mock/base'
import type { ColumnDef, PageDef } from '@/config/types'
import { resolveRule, type ActionRule } from '@/config/actionRules'
import { exportCsv, stamp, copyText } from '@/utils/export'
import { buildPreview } from '@/utils/preview'
import { confirmDialog } from '@/utils/confirm'

export interface ActionContext {
  /** 动作发生在哪个页面（PageDef 的 key） */
  pageKey?: string
  /** 行操作时的当前行 */
  row?: any
  /** 工具栏批量操作时勾选的行 */
  selected?: any[]
  /** 当前结果集（未勾选时批量作用于此） */
  allRows?: any[]
}

/** 动作名 → 目标页面（当「实体名」无法从当前页标题推断时使用） */
const entityPage: Record<string, string> = {
  新建线索: 'lead', 新建客户: 'account', 新建联系人: 'contact', 新建商机: 'opportunity',
  新建报价: 'quote', 新建合同: 'contract', 新建产品: 'product', 新建流程: 'flow',
  发起请假: 'leave', 发起出差: 'travel', 发起加班: 'overtime', 发起报销: 'expense',
  发布公告: 'notice', 预订会议室: 'meeting', 新建文档: 'knowledge', 新增员工: 'staff',
  登记印章: 'seal', 新建目标: 'okr', 新建日程: 'schedule', 新建账套: 'bookset',
  新增科目: 'finAccount', 新增凭证: 'voucher', 新增账户: 'bank', 新增资产: 'asset',
  登记收支: 'cashier', 新增用户: 'sysUser', 新建角色: 'role', 新增部门: 'dept',
  新建字典: 'dict', 新建规则: 'numberRule', 开通租户: 'tenant', 新增参数: 'config',
  开具发票: 'invoice',
}

/** 取一行记录里最能代表它的标题字段（通知 / 催办类提示里要显示是哪一条） */
function rowLabel(row: any): string {
  if (!row) return ''
  return (
    row.name ?? row.title ?? row.subject ?? row.objective ?? row.customer ??
    row.supplier ?? row.code ?? row.id ?? ''
  )
}

/** 阶段推进路径（advance 动作） */
const stageFlow: Record<string, { field: string; values: string[] }> = {
  opportunity: { field: 'stage', values: ['需求确认', '方案演示', '方案报价', '商务谈判', '合同签署'] },
  lead: { field: 'intent', values: ['高', '中', '低'] },
  leadPool: { field: 'status', values: ['待领取', '待分配', '已锁定'] },
  quote: { field: 'status', values: ['草稿', '审批中', '已通过'] },
  contract: { field: 'status', values: ['草稿', '审批中', '已通过'] },
  ar: { field: 'status', values: ['待回款', '部分回款', '已回款'] },
  ap: { field: 'status', values: ['待付款', '部分付款', '已付款'] },
  expense: { field: 'status', values: ['审批中', '已通过', '已支付'] },
  voucher: { field: 'status', values: ['草稿', '审批中', '已审核'] },
  recon: { field: 'status', values: ['未对账', '对账中', '已对账'] },
  invoice: { field: 'status', values: ['待开票', '已开具', '已查验'] },
}

/**
 * 转化预填：目标字段 ← 来源字段
 * ---------------------------------------------------------------------------
 * 值为候选来源字段列表（按顺序取第一个有值的）；空数组表示「不从来源带过来」。
 * 注意目标字段名要和 PageDef.columns 的 key 完全一致 —— 写错 key 预填就落不了地。
 */
const convertAlias: Record<string, Record<string, string[]>> = {
  opportunity: {
    name: ['name', 'title', 'company'], customer: ['customer', 'company', 'name'],
    amount: ['amount', 'value', 'budget', 'contractValue'], stage: ['stage'],
    probability: ['probability'], expectedClose: ['expectedClose', 'date', 'dueDate'],
    source: ['source'], owner: ['owner'],
  },
  account: {
    name: ['name', 'company', 'customer', 'title'], industry: ['industry'], city: ['city'],
    level: ['level'], owner: ['owner'], contractValue: ['contractValue', 'amount', 'value', 'budget'],
  },
  contract: {
    title: ['title', 'name'], customer: ['customer', 'company', 'name'],
    amount: ['amount', 'value', 'budget', 'contractValue'], signDate: ['signDate', 'date'],
    endDate: ['endDate'], owner: ['owner'],
  },
  quote: {
    title: ['title', 'name'], customer: ['customer', 'company', 'name'],
    amount: ['amount', 'value', 'budget', 'contractValue'], validDays: ['validDays'], version: ['version'],
  },
  ar: {
    customer: ['customer', 'company', 'name'], contract: ['contract', 'title'],
    total: ['total', 'amount', 'value', 'budget', 'contractValue'], period: ['period'],
    dueDate: ['dueDate', 'date', 'signDate', 'endDate'],
  },
  follow: {
    customer: ['customer', 'company', 'name'], contact: ['contact'],
    content: ['content', 'summary', 'words', 'title', 'name'], way: ['way'],
    nextAt: ['nextAt', 'date', 'createdAt'], owner: ['owner'],
  },
  voucher: {
    words: ['words', 'summary', 'content', 'title', 'name', 'supplier', 'customer', 'category'],
    debit: ['debit', 'amount', 'value', 'budget', 'total'],
    credit: [],
    date: ['date', 'dueDate', 'signDate', 'createdAt'], period: ['period', 'date'],
    bookset: ['bookset'], owner: ['owner', 'applicant', 'keeper', 'creator'], source: [],
  },
  approval: {
    title: ['title', 'name', 'customer', 'supplier'], applicant: ['applicant', 'owner'],
    amount: ['amount', 'value', 'total'], type: ['type', 'category'], dept: ['dept'],
    currentNode: ['currentNode', 'node'], urgency: ['urgency'], owner: ['owner'],
  },
}

/**
 * 「主字段」集合 —— 批量转化时，目标记录至少要落上一项，否则生成出来的是空壳。
 * 之前用「目标页第一个非 id 列」来判断，导致凭证页取到 code、审批页取到 type，
 * 这两个字段预填从来填不上，于是整批被当成「缺少必要字段」跳过。
 */
const CORE_FIELDS = [
  'name', 'title', 'customer', 'supplier', 'summary', 'words', 'content', 'objective',
  'subject', 'company', 'contract', 'account', 'product', 'payee', 'employee',
  'category', 'period', 'type', 'code', 'number', 'amount', 'total', 'debit', 'credit',
]

/** 参数默认值（平台参数「重置」动作） */
const paramDefaults: Record<string, string> = {
  'tenant.default_plan': '专业版 Professional', 'tenant.max_users': '1000',
  'security.login_fail_lock': '5', 'security.password_expire_days': '90',
  'security.sso_enabled': 'true', 'fin.voucher_auto_generate': 'true',
  'fin.close_day': '25', 'fin.currency_default': 'CNY', 'crm.lead_recycle_days': '30',
  'crm.opportunity_auto_rate': 'true', 'oa.approver_timeout_hours': '48',
  'oa.auto_upgrade': 'true',
}

/** 页面级动作覆盖（同名动作在不同页面语义不同） */
const pageOverrides: Record<string, Record<string, ActionRule>> = {
  ar: { 核销: { kind: 'approve', field: 'status', value: '已核销' }, 收单: { kind: 'notify', tip: '收单请求已发送至对方' } },
  ap: { 核销: { kind: 'approve', field: 'status', value: '已核销' }, 付款: { kind: 'setStatus', field: 'status', value: '已付款' } },
  bankFlow: { 核销: { kind: 'approve', field: 'reconciled', value: '是' }, 批量核销: { kind: 'approve', field: 'reconciled', value: '是', needSelect: true, verb: '核销', entity: '流水' } },
  invoice: {
    查验: { kind: 'approve', field: 'status', value: '已查验' },
    批量查验: { kind: 'approve', field: 'status', value: '已查验', needSelect: true },
    开具: { kind: 'setStatus', field: 'status', value: '已开具' },
  },
  voucher: { 审核: { kind: 'approve', field: 'status', value: '已审核' }, 批量审核: { kind: 'approve', field: 'status', value: '已审核', needSelect: true } },
  notice: { 置顶: { kind: 'toggle', field: 'top', value: '是', value2: '否' } },
  flow: { 启停: { kind: 'toggle', field: 'status', value: '启用', value2: '停用' } },
  config: { 重置: { kind: 'custom', custom: 'resetParam' } },
  tax: { 申报: { kind: 'setStatus', field: 'status', value: '已申报' }, 缴款: { kind: 'setStatus', field: 'status', value: '已缴款' } },
  close: { 结账: { kind: 'setStatus', field: 'status', value: '已结账' }, 反结账: { kind: 'setStatus', field: 'status', value: '未结账', danger: true } },
  staff: { 离职: { kind: 'setStatus', field: 'status', value: '离职', danger: true } },
  // 线索池「领取」＝ 挂负责人 + 锁定；账套「结账」＝ 关掉当前会计期间（状态列是账套的启用状态，不能拿来记结账）
  leadPool: { 领取: { kind: 'custom', custom: 'claimLead' } },
  bookset: { 结账: { kind: 'custom', custom: 'closeBookset' } },
}

function resolveFor(name: string, pageKey?: string): ActionRule {
  const over = pageKey ? pageOverrides[pageKey]?.[name] : undefined
  if (over) return over
  return resolveRule(name)
}

/** 找到承载状态的列 */
function pickStatusColumn(def: PageDef, desired: string): ColumnDef | undefined {
  const withMap = def.columns.filter((c) => c.statusMap && Object.keys(c.statusMap).length)
  return (
    withMap.find((c) => c.statusMap && desired in c.statusMap) ||
    withMap.find((c) => c.key === 'status') ||
    withMap[0]
  )
}

/**
 * 写入状态。
 * 优先写规则里显式声明的字段（如银行流水的「已对账」、联系人的「关键人」），
 * 找不到该列时才回退到「承载状态的列」；目标值不在字典里则回退到字典中的成功态。
 */
function applyStatus(def: PageDef, row: any, desired: string, field?: string, fallback?: string) {
  const explicit = field ? def.columns.find((c) => c.key === field) : undefined
  const col = explicit ?? pickStatusColumn(def, desired)
  if (!col) return null
  const map = col.statusMap ?? {}
  // 普通字段（如「是否关键人」）没有状态字典，按原值直写
  if (!Object.keys(map).length) {
    row[col.key] = desired
    return { key: col.key, value: desired }
  }
  let value = desired
  if (!(value in map)) {
    const keys = Object.keys(map)
    value =
      keys.find((k) => map[k].color === 'success' && k.startsWith('已')) ||
      keys.find((k) => map[k].color === 'success') ||
      fallback ||
      keys[0] ||
      desired
  }
  row[col.key] = value
  return { key: col.key, value }
}

/** 今天的日期 / 当前期间 —— 生成的单据要落在演示数据的时间线里 */
function todayStr() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function monthStr() {
  return todayStr().slice(0, 7)
}

/**
 * 目标页的默认预填：来源没带过来的字段，用「业务上说得通」的值补上。
 * 期间取目标页已有数据里的最大期间（演示数据是 2025 年的，用真实当天会串台）。
 */
function applyConvertDefaults(def: PageDef, preset: Record<string, any>) {
  const has = (k: string) => def.columns.some((c) => c.key === k)
  if (has('period') && !preset.period) {
    const periods = (pages[def.key]?.data ?? [])
      .map((r: any) => String(r?.period ?? ''))
      .filter((v: string) => /^\d{4}-\d{2}$/.test(v))
      .sort()
    preset.period = periods[periods.length - 1] ?? monthStr()
  }
  if (has('date') && !preset.date) {
    const p = String(preset.period ?? '')
    const day = new Date().getDate()
    preset.date = /^\d{4}-\d{2}$/.test(p) ? `${p}-${String(day).padStart(2, '0')}` : todayStr()
  }
  if (has('source') && !preset.source) preset.source = '业务单据'
  if (has('bookset') && !preset.bookset) {
    const booksets = pages.bookset?.data ?? []
    const bs = booksets.find((b: any) => b.status === '使用中') ?? booksets.find((b: any) => b.status === '启用') ?? booksets[0]
    if (bs?.name) preset.bookset = bs.name
  }
}

/** 预填值里的占位符求值 */
function resolvePresetValue(v: any, row: any, owner: string) {
  if (v === '@amount') return Number(row?.amount ?? row?.value ?? row?.total ?? row?.budget ?? 0)
  if (v === '@user') return owner
  if (v === '@today') return todayStr()
  return v
}

/**
 * 生成转化预填值。
 * 顺序：别名映射 → 目标页默认 → 规则里显式声明的 preset（优先级最高）。
 */
function convertPreset(
  targetKey: string,
  row: any,
  extra?: Record<string, any>,
  owner = '',
): Record<string, any> {
  const def = pages[targetKey]
  if (!def || !row) return {}
  const preset: Record<string, any> = {}
  const alias = convertAlias[targetKey] ?? {}
  for (const col of def.columns) {
    if (col.key === 'id') continue
    // 「状态」不跟着来源记录走：来源是「审批中」的报销单，转出来的凭证应该是「草稿」，
    // 目标页有自己的初始状态（除非别名表或规则里显式指定）
    if (col.key === 'status' && !alias.status) continue
    const candidates = alias[col.key] ?? [col.key]
    for (const src of candidates) {
      if (row[src] !== undefined && row[src] !== '' && row[src] !== null) {
        preset[col.key] = row[src]
        break
      }
    }
  }
  applyConvertDefaults(def, preset)
  if (hasOwnerColumn(def) && !preset.owner && owner) preset.owner = owner
  for (const [k, v] of Object.entries(extra ?? {})) {
    preset[k] = resolvePresetValue(v, row, owner)
  }
  return preset
}

function hasOwnerColumn(def: PageDef) {
  return def.columns.some((c) => c.key === 'owner')
}

/** 批量转化时，目标记录至少要有一项「主字段」落得上，否则跳过 */
function hasCoreField(def: PageDef | undefined, preset: Record<string, any>): boolean {
  if (!def) return true
  const cols = def.columns.filter((c) => CORE_FIELDS.includes(c.key))
  if (!cols.length) return true
  return cols.some((c) => String(preset[c.key] ?? '').trim() !== '')
}

/** 推断新增动作的目标页面 */
function createTarget(pageKey: string, name: string, entity?: string) {
  const title = pages[pageKey]?.title ?? ''
  const word = entity ?? name.replace(/^(新建|新增|发起|登记|发布|录入|开具|开通|创建|复制)/, '')
  if (word && title.includes(word)) return pageKey
  return entityPage[name] ?? pageKey
}

export function useAction() {
  const data = useDataStore()
  const ui = useUiStore()
  const user = useUserStore()
  const router = useRouter()

  /** 当前时间戳文本 */
  function now() {
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  }

  function toastOk(text: string) {
    message.success(text)
  }

  /** 记录一条站内消息（催办 / 提醒 / 分享等的可见痕迹） */
  function pushMessage(title: string, type = '业务提醒', priority = '重要') {
    data.addRow('message', {
      title,
      type,
      from: user.user.name,
      priority,
      read: '未读',
      sendAt: now(),
    })
  }

  /** 导入：按现有记录克隆若干条，写入仓库 */
  function importRows(pageKey: string, count = 5) {
    const src = data.rows(pageKey)
    if (!src.length) {
      message.warning('当前没有可参照的模板数据')
      return
    }
    const picks: Record<string, any>[] = []
    for (let i = 0; i < count; i++) picks.push({ ...src[Math.floor(Math.random() * src.length)] })
    for (const p of picks) {
      delete p.id
      // 以「编码」作主键的页面（会计科目、凭证）导入时要重新编号，不能沿用来源的编码
      if (pages[pageKey]?.columns[0]?.key === 'code') delete p.code
      data.addRow(pageKey, p)
    }
    toastOk(`已成功导入 ${count} 条记录`)
  }

  /** 阶段推进（quiet=true 时不弹提示，批量场景由调用方汇总） */
  function advanceStage(pageKey: string, row: any, def: PageDef, quiet = false) {
    const flow = stageFlow[pageKey]
    if (!flow) {
      const col = pickStatusColumn(def, '已通过')
      if (!col) return false
      const res = applyStatus(def, row, '已通过')
      if (!quiet) toastOk(`已推进至「${res?.value ?? '下一阶段'}」`)
      return true
    }
    const cur = String(row[flow.field] ?? '')
    const idx = flow.values.indexOf(cur)
    const next = flow.values[Math.min(idx + 1, flow.values.length - 1)]
    if (idx < 0) {
      row[flow.field] = flow.values[0]
      if (!quiet) toastOk(`已进入「${flow.values[0]}」阶段`)
      return true
    }
    if (idx >= flow.values.length - 1) {
      if (!quiet) message.info(`已在最后一个阶段「${cur}」，无法继续推进`)
      return false
    }
    row[flow.field] = next
    if (!quiet) toastOk(`已从「${cur}」推进至「${next}」`)
    return true
  }

  /** 具名的特殊动作 */
  function runCustom(rule: ActionRule, pageKey: string, targets: any[], def?: PageDef) {
    switch (rule.custom) {
      case 'releasePool': {
        const rows = data.rows('leadPool')
        let n = 0
        for (const r of rows) {
          if (r.status === '已锁定' || r.status === '待分配') {
            r.status = '待领取'
            n++
          }
        }
        toastOk(n ? `已将 ${n} 条超时线索退回公海` : '暂无超时未跟进的线索')
        return
      }
      case 'releaseSelected': {
        // 批量退回公海：只处理选中的那几条
        const rows = targets.length ? targets : data.rows(pageKey)
        let n = 0
        for (const r of rows) {
          r.status = '待领取'
          n++
        }
        toastOk(n ? `已将 ${n} 条线索退回公海` : '没有可退回的线索')
        return
      }
      case 'syncLedger': {
        const rows = targets.length ? targets : data.rows(pageKey)
        // 会计科目以「编码」作主键，id 是空的 —— 取 id ?? code 才能命中行
        const ids = rows.map((r: any) => r.id ?? r.code).filter((v: any) => v !== undefined && v !== null)
        const n = data.patchRows(pageKey, ids, { syncedAt: now().slice(0, 16) })
        toastOk(n ? `已同步 ${n} 个科目至目标账套` : '没有可同步的科目')
        return
      }
      case 'autoMatch': {
        const rows = data.rows('bankFlow')
        let n = 0
        for (const r of rows) {
          if (r.reconciled === '否' && r.voucher) {
            r.reconciled = '是'
            n++
          }
        }
        toastOk(n ? `已自动匹配核销 ${n} 条未达流水` : '没有需要匹配的流水')
        return
      }
      case 'depreciate': {
        const rows = targets.length ? targets : data.rows(pageKey)
        let n = 0
        for (const r of rows) {
          const original = Number(r.original ?? 0)
          const acc = Number(r.accumulated ?? 0) + +(original * 0.02).toFixed(2)
          r.accumulated = acc
          r.net = +(original - acc).toFixed(2)
          n++
        }
        toastOk(`已按月度 2% 规则对 ${n} 项资产计提折旧`)
        return
      }
      case 'readAll': {
        const rows = data.rows('message')
        let n = 0
        for (const r of rows) {
          if (r.read === '未读') {
            r.read = '已读'
            n++
          }
        }
        toastOk(n ? `已将 ${n} 条消息标记为已读` : '没有未读消息')
        return
      }
      case 'resetParam': {
        const rows = targets.length ? targets : data.rows(pageKey)
        for (const r of rows) {
          r.value = paramDefaults[r.key] ?? '—'
          r.operator = user.user.name
          r.updateAt = now().slice(0, 10)
        }
        toastOk(`已恢复 ${rows.length} 项参数的默认值`)
        return
      }
      case 'claimLead': {
        // 领取线索：挂上负责人并锁定，锁定后才算真正「领走」
        const rows = targets.length ? targets : data.rows(pageKey)
        let n = 0
        for (const r of rows) {
          r.owner = user.user.name
          r.status = '已锁定'
          n++
        }
        toastOk(n ? `已领取 ${n} 条线索并锁定` : '没有可领取的线索')
        return
      }
      case 'closeBookset': {
        // 账套结账：关掉当前会计期间，期间推进到下一个月（状态列仍是账套的启用状态）
        const rows = targets.length ? targets : data.rows(pageKey)
        let n = 0
        for (const r of rows) {
          const p = String(r.period ?? '')
          const m = p.match(/^(\d{4})-(\d{2})$/)
          if (m) {
            let mm = Number(m[2]) + 1
            let yy = Number(m[1])
            if (mm > 12) {
              mm = 1
              yy += 1
            }
            r.period = `${yy}-${String(mm).padStart(2, '0')}`
          }
          r.closeAt = now().slice(0, 10)
          r.owner = user.user.name
          n++
        }
        toastOk(n ? `已结账 ${n} 个账套，期间已推进到下月` : '没有可结账的账套')
        return
      }
      default:
        toastOk(rule.tip ?? `${rule.custom} 已执行`)
    }
  }

  /**
   * 把传入的行对象对齐到仓库里的「活记录」。
   * 列表页为了渲染行号会给每行克隆一份（`{ ...row, __key }`），
   * 克隆对象上的赋值写不回仓库 —— 审批 / 置状态 / 开关这类直接改字段的动作就会失效。
   * 这里按 id 把行换回仓库里的那一份，动作才真正落到数据上。
   */
  function liveRow(pageKey: string, row: any) {
    if (!row) return row
    const id = row.id ?? row.code
    if (id === undefined || id === null || id === '') return row
    const hit = data.rows(pageKey).find((r: any) => (r.id ?? r.code) === id)
    return hit ?? row
  }

  /**
   * 执行一个动作。全站按钮都走这里，保证行为一致。
   */
  function run(name: string, ctx: ActionContext = {}) {
    const rule = resolveFor(name, ctx.pageKey)
    const pageKey = ctx.pageKey ?? ''
    const def = pageKey ? pages[pageKey] : undefined
    const entity = rule.entity ?? def?.title ?? '记录'

    // 需要勾选但没勾 → 明确提示，不静默失败
    if (rule.needSelect && !ctx.row && !(ctx.selected && ctx.selected.length)) {
      message.warning(`请先勾选需要处理的${entity}数据`)
      return
    }

    const targets: any[] = ctx.row
      ? [liveRow(pageKey, ctx.row)]
      : ctx.selected && ctx.selected.length
        ? ctx.selected.map((r: any) => liveRow(pageKey, r))
        : ctx.allRows ?? []

    /** 当前行（已对齐到仓库活记录） */
    const row = ctx.row ? liveRow(pageKey, ctx.row) : undefined

    switch (rule.kind) {
      /* ---------------- 表单类 ---------------- */
      case 'create': {
        const target = createTarget(pageKey, name, rule.entity)
        ui.openCreate(target, row ? convertPreset(target, row, rule.preset, user.user.name) : {})
        return
      }
      case 'edit': {
        if (!row) {
          message.warning('请先选择一条记录')
          return
        }
        ui.openEdit(pageKey, row)
        return
      }
      case 'convert': {
        const target = rule.target ?? pageKey
        // 批量转化：按每一行直接生成目标单据（单行时仍走表单，便于补全与确认）
        if (rule.needSelect) {
          const targetDef = pages[target]
          let n = 0
          let skipped = 0
          for (const r of targets) {
            const preset = convertPreset(target, r, rule.preset, user.user.name)
            if (!hasCoreField(targetDef, preset)) {
              skipped++
              continue
            }
            data.addRow(target, preset)
            n++
          }
          const title = targetDef?.title ?? '记录'
          toastOk(
            skipped
              ? `已生成 ${n} 条${title}${skipped ? `，${skipped} 条缺少必要字段已跳过` : ''}`
              : `已生成 ${n} 条${title}`,
          )
          return
        }
        if (!row) {
          message.warning('请先选择一条记录')
          return
        }
        ui.openCreate(target, convertPreset(target, row, rule.preset, user.user.name))
        return
      }

      /* ---------------- 数据变更类 ---------------- */
      case 'remove': {
        confirmDialog({
          title: `确认${rule.danger ? '删除' : '移除'}${entity}？`,
          content: `将${targets.length ? `影响 ${targets.length} 条` : ''}记录，删除后不可恢复。`,
          okText: '确认删除',
          okType: 'danger',
          cancelText: '取消',
          onOk: () => {
            const ids = targets.map((r) => r.id ?? r.code).filter((v) => v !== undefined && v !== null)
            const n = data.removeRows(pageKey, ids)
            toastOk(`已删除 ${n} 条${entity}`)
          },
        })
        return
      }
      case 'approve':
      case 'reject':
      case 'setStatus': {
        const desired =
          rule.value ?? (rule.kind === 'approve' ? '已通过' : rule.kind === 'reject' ? '已驳回' : '已处理')
        // 动词用动作的真实语义：核销 / 付款 / 开具 …，而不是一律「通过」。
        // 规则里显式写了 verb 的优先 —— 「批量核销」写的是 reconciled=是，
        // 从状态值推导会得到「确认是？」这种读不通的标题。
        const derivedVerb =
          rule.kind === 'approve'
            ? rule.value && rule.value !== '已通过'
              ? rule.value.replace(/^已/, '')
              : '通过'
            : rule.kind === 'reject'
              ? rule.value && rule.value !== '已驳回'
                ? rule.value.replace(/^已/, '')
                : '驳回'
              : ''
        const isStatusSet = rule.kind === 'setStatus'
        const verb = rule.verb ?? derivedVerb
        confirmDialog({
          title: verb ? `确认${verb}？` : `确认置为「${desired}」？`,
          content: `将对 ${targets.length} 条${entity}执行「${desired}」操作。`,
          okText: '确认',
          cancelText: '取消',
          onOk: () => {
            if (!def) return
            let n = 0
            for (const row of targets) {
              const res = applyStatus(def, row, desired, rule.field)
              if (!res) continue
              n++
              // 审批类动作同时更新处理人
              if (rule.kind !== 'setStatus') {
                const approverCol = def.columns.find((c) => c.key === 'approver')
                if (approverCol) row[approverCol.key] = user.user.name
              }
            }
            pushMessage(
              isStatusSet ? `${entity}已置为「${desired}」：共 ${n} 条` : `${entity}已${verb}：共 ${n} 条`,
              '审批提醒',
              '重要',
            )
            toastOk(
              isStatusSet && rule.verb
                ? `已${rule.verb} ${n} 条${entity}`
                : isStatusSet
                  ? `已将 ${n} 条${entity}置为「${desired}」`
                  : `已${verb} ${n} 条${entity}`,
            )
          },
        })
        return
      }
      case 'toggle': {
        // 批量开关：逐条切换（已经是目标值的保持不变）
        if (!row && !rule.needSelect) {
          message.warning('请先选择一条记录')
          return
        }
        const field = rule.field ?? 'status'
        let n = 0
        for (const r of targets) {
          const cur = String(r[field] ?? '')
          const next = cur === rule.value ? (rule.value2 ?? '') : rule.value
          r[field] = next
          n++
        }
        const last = targets[targets.length - 1]
        const nextVal = String(last?.[field] ?? '')
        if (n === 1) {
          toastOk(nextVal ? `已置为「${nextVal}」` : '已取消')
        } else {
          toastOk(nextVal ? `已置为「${nextVal}」（${n} 条）` : `已取消（${n} 条）`)
        }
        return
      }
      case 'advance': {
        if (!def || (!row && !rule.needSelect)) {
          message.warning('请先选择一条记录')
          return
        }
        // 批量推进：逐条往后走一个阶段
        if (rule.needSelect) {
          let n = 0
          for (const r of targets) if (advanceStage(pageKey, r, def, true)) n++
          toastOk(`已推进 ${n} 条${rule.entity ?? def.title}的阶段`)
          return
        }
        advanceStage(pageKey, row!, def)
        return
      }
      case 'assign': {
        const ids = targets.map((r) => r.id ?? r.code).filter((v) => v !== undefined && v !== null)
        if (!ids.length) {
          message.warning('请先选择一条记录')
          return
        }
        ui.openAssign(pageKey, ids, rule.field ?? 'owner', name)
        return
      }

      /* ---------------- 文件类 ---------------- */
      case 'export': {
        const cols = (def?.columns ?? []).filter((c) => c.key !== '__action')
        // 「导出」导当前筛选结果集，「批量导出」只导勾选的那些
        const rows = rule.needSelect ? targets : ctx.allRows?.length ? ctx.allRows : targets
        if (!rows.length) {
          message.warning('当前没有可导出的数据')
          return
        }
        exportCsv(`${entity}-${stamp()}`, cols.map((c) => ({ key: c.key, title: c.title })), rows)
        toastOk(`已导出 ${rows.length} 条${entity}数据`)
        return
      }
      case 'import': {
        importRows(pageKey, 5)
        return
      }

      /* ---------------- 查看类 ---------------- */
      case 'detail': {
        if (!row) {
          message.warning('请先选择一条记录')
          return
        }
        ui.openDetail(pageKey, row)
        return
      }
      case 'preview': {
        ui.openPreview(name, buildPreview(name, pageKey, row ?? ctx.row))
        return
      }
      case 'open': {
        if (rule.path) router.push(rule.path)
        return
      }

      /* ---------------- 通知类 ---------------- */
      case 'notify': {
        // 批量通知：每条记录各生成一条提醒，单条时沿用原来的文案
        if (rule.needSelect) {
          for (const r of targets) {
            pushMessage(`${rule.tip ?? name}：${entity}「${rowLabel(r)}」`, '业务提醒', '重要')
          }
          toastOk(`${rule.tip ?? name}（${targets.length} 条）`)
          return
        }
        const label = ctx.row ? `${entity}「${rowLabel(ctx.row)}」` : entity
        pushMessage(`${rule.tip ?? name}：${label}`, '业务提醒', '重要')
        if (name === '分享') {
          const link = `${window.location.origin}${window.location.pathname}#/share/${pageKey}/${ctx.row?.id ?? 'demo'}`
          copyText(link).then((ok) =>
            ok ? message.success(`分享链接已复制：${link}`) : message.success('分享链接已生成'),
          )
          return
        }
        toastOk(rule.tip ?? `已${name}`)
        return
      }

      case 'custom': {
        runCustom(rule, pageKey, targets, def)
        return
      }
    }
  }

  return { run }
}

/** 供独立视图使用：把人员/角色/部门候选暴露给分配弹窗 */
export function assignOptions(field: string) {
  if (field === 'role') {
    return (pages.role?.data ?? []).map((r: any) => r.name).filter(Boolean)
  }
  if (field === 'dept') {
    return (pages.dept?.data ?? []).map((r: any) => r.name).filter(Boolean)
  }
  return people.map((p) => p.name)
}
