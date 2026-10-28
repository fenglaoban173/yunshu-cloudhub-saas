<script setup lang="ts">
/**
 * 财务报表
 * ---------------------------------------------------------------------------
 * 页面上每个按钮 / 交互都是真实行为，没有占位提示：
 *  - 导出：按「当前期间 + 当前报表类型」导出行项目（项目名称 / 本期金额 / 上期金额 /
 *    同比）为 CSV，真实下载
 *  - 打印：给 body 打上打印视图 class（只保留报表主体），调用浏览器原生打印
 *  - 期间切换：真正切换报表数据，金额随期间结转系数变化
 *  - 查看明细：打开全局预览，展示该行项目的本期 / 上期金额与相关账簿发生明细
 *
 * 金额口径：
 *  - 三张主表以「元」展示，金额由基期结转数与**凭证库中各期间的真实发生额**推导，
 *    切换期间即得到不同的结转结果（结转系数见 flowFactor / balanceFactor）
 *  - 科目余额表取自**总账明细**：期初余额沿用上期结转，本期发生额为所选期间的发生数
 *    （总账金额单位为万元，报表按元展示需乘 10000 换算）
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import BaseChart from '@/components/BaseChart.vue'
import AppIcon from '@/components/AppIcon.vue'
import { balanceSheet, incomeStatement, cashFlow } from '@/mock/finance'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import { exportCsv, stamp } from '@/utils/export'
import type { PreviewSection } from '@/utils/preview'

interface ReportLine {
  name: string
  line: number
  current: number
  prior: number
  sum?: boolean
  total?: boolean
  group?: boolean
}

/** 科目余额表的一行 */
interface AccountRow {
  code: string
  name: string
  dir: string
  open: number
  debit: number
  credit: number
  bal: number
}

const data = useDataStore()
const ui = useUiStore()
const route = useRoute()

const activeTab = ref('资产负债表')
const period = ref('2025-10')

const PERIODS = ['2025-08', '2025-09', '2025-10']
const BASE_PERIOD = '2025-10'

/* ========================================================== 深链定位 */
/**
 * 报表支持两种深链参数：
 *  - ?tab=利润表 —— 直接切到对应报表
 *  - ?focus=研发费用 —— 高亮对应行（成本结构图下钻用）
 */
const TABS = ['资产负债表', '利润表', '现金流量表', '科目余额表']

/** 报表行的核心名：去掉「一、」「减：」这类前缀，便于按关键词定位 */
function coreName(name: string) {
  return name.replace(/^[一二三四五六七八九十]+、/, '').replace(/^(减|加)：/, '').trim()
}

const focusKey = computed(() => String(route.query.focus ?? ''))

/** 该行是否是被定位的那一行 */
function isFocused(name: string) {
  const f = coreName(focusKey.value)
  if (!f) return false
  const c = coreName(name)
  return !!c && (c.includes(f) || f.includes(c))
}

watch(
  () => route.query.tab,
  (t) => {
    const tab = String(t ?? '')
    if (tab && TABS.includes(tab)) activeTab.value = tab
  },
  { immediate: true },
)

const fmt = (v: number) =>
  v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const periodLabel = computed(() => period.value.replace('-', ' 年 ') + ' 月')

/** 期间下拉：固定三个期间 + 当前选中的期间（趋势图点出来的月份会临时多一个） */
const periodOptions = computed(() => {
  const list = [...PERIODS]
  if (!list.includes(period.value)) list.push(period.value)
  return list.map((p) => ({ label: p, value: p }))
})

/* ========================================================== 期间结转系数 */
/** 凭证库中各期间的借方发生额（真实数据） */
const turnover = computed(() => {
  const map: Record<string, number> = {}
  for (const v of data.rows('voucher') as any[]) {
    const p = String(v.period ?? '')
    if (!p) continue
    map[p] = (map[p] ?? 0) + Number(v.debit ?? 0)
  }
  return map
})
/** 自年初起累计发生额 */
function cumulativeThrough(p: string) {
  let sum = 0
  for (const [k, v] of Object.entries(turnover.value)) {
    if (k <= p) sum += v
  }
  return sum
}
/** 期间发生额比值（利润表 / 现金流量表用）：当期发生额相对基期的平滑比 */
function flowFactor(p: string) {
  const list = Object.values(turnover.value)
  const avg = list.length ? list.reduce((s, v) => s + v, 0) / list.length : 0
  const base = turnover.value[BASE_PERIOD] ?? 0
  const cur = turnover.value[p] ?? 0
  const den = base + avg
  if (!den) return 1
  return Math.min(1.5, (cur + avg) / den)
}
/** 累计结转系数（资产负债表用）：自年初累计发生额相对基期的比 */
function balanceFactor(p: string) {
  const base = cumulativeThrough(BASE_PERIOD)
  if (!base) return 1
  return cumulativeThrough(p) / base
}
function prevPeriod(p: string) {
  const [y, m] = p.split('-')
  const mm = Number(m) - 1
  return mm < 1 ? `${Number(y) - 1}-12` : `${y}-${String(mm).padStart(2, '0')}`
}
/** 流量表金额：基期上下按期间发生额比值结转 */
function flowValue(row: { current: number; prior: number }, p: string) {
  return row.prior + (row.current - row.prior) * flowFactor(p)
}
/** 存量表金额：期末余额 = 年初余额 + (基期期末 - 年初) × 累计结转系数 */
function balanceValue(row: { current: number; prior: number }, p: string) {
  return row.prior + (row.current - row.prior) * balanceFactor(p)
}

/* ========================================================== 报表数据 */
/** 资产负债表左右两栏 */
const assets = computed<ReportLine[]>(() =>
  balanceSheet.assets.map((r) => ({ ...r, current: balanceValue(r, period.value) })),
)
const liabilities = computed<ReportLine[]>(() =>
  balanceSheet.liabilities.map((r) => ({ ...r, current: balanceValue(r, period.value) })),
)
const equity = computed<ReportLine[]>(() =>
  balanceSheet.equity.map((r) => ({ ...r, current: balanceValue(r, period.value) })),
)
const income = computed<ReportLine[]>(() =>
  incomeStatement.map((r) => ({
    ...r,
    current: flowValue(r, period.value),
    prior: flowValue(r, prevPeriod(period.value)),
  })),
)
const cash = computed<ReportLine[]>(() =>
  cashFlow.map((r) => ({
    ...r,
    current: flowValue(r, period.value),
    prior: flowValue(r, prevPeriod(period.value)),
  })),
)

/** 合计只统计明细行（排除小计 / 合计行） */
function sumLeaf(rows: ReportLine[]) {
  return rows.filter((r) => !r.sum && !r.total).reduce((s, r) => s + r.current, 0)
}
const assetTotal = computed(() => sumLeaf(assets.value))
const liabilityTotal = computed(() => sumLeaf(liabilities.value))
const equityTotal = computed(() => sumLeaf(equity.value))
const balanceDiff = computed(
  () => +(assetTotal.value - liabilityTotal.value - equityTotal.value).toFixed(2),
)

/** 同比 */
function yoyOf(current: number, prior: number) {
  if (!prior) return '—'
  const v = ((current - prior) / Math.abs(prior)) * 100
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
}

/* ========================================================== 科目余额表 */
/** 期初余额（上期结转数） */
const OPENING: { code: string; name: string; dir: string; open: number }[] = [
  { code: '1001', name: '库存现金', dir: '借', open: 18240.55 },
  { code: '1002', name: '银行存款', dir: '借', open: 6239380.0 },
  { code: '1122', name: '应收账款', dir: '借', open: 5120480.0 },
  { code: '1601', name: '固定资产', dir: '借', open: 3486220.0 },
  { code: '2202', name: '应付账款', dir: '贷', open: 2860400.0 },
  { code: '2211', name: '应付职工薪酬', dir: '贷', open: 912600.0 },
  { code: '2221', name: '应交税费', dir: '贷', open: 512340.0 },
  { code: '6001', name: '主营业务收入', dir: '贷', open: 0 },
  { code: '6401', name: '主营业务成本', dir: '借', open: 0 },
  { code: '6601', name: '销售费用', dir: '借', open: 0 },
  { code: '6602', name: '管理费用', dir: '借', open: 0 },
]

const accountRows = computed<AccountRow[]>(() => {
  const acc = new Map<string, AccountRow>()
  const ensure = (code: string, name: string, dir: string): AccountRow => {
    let row = acc.get(code)
    if (!row) {
      row = { code, name, dir, open: 0, debit: 0, credit: 0, bal: 0 }
      acc.set(code, row)
    }
    return row
  }
  for (const o of OPENING) {
    const row = ensure(o.code, o.name, o.dir)
    row.open = o.open
  }
  const cur = period.value
  // 总账发生额（万元）→ 报表口径（元）
  const cum = new Map<string, { d: number; c: number }>()
  const now = new Map<string, { d: number; c: number }>()
  for (const g of data.rows('gl') as any[]) {
    const account = String(g.account ?? '')
    const code = account.slice(0, 4)
    if (!code) continue
    const p = String(g.period ?? '')
    const d = Number(g.debit ?? 0) * 10000
    const c = Number(g.credit ?? 0) * 10000
    if (p <= cur) {
      const item = cum.get(code) ?? { d: 0, c: 0 }
      item.d += d
      item.c += c
      cum.set(code, item)
    }
    if (p === cur) {
      const item = now.get(code) ?? { d: 0, c: 0 }
      item.d += d
      item.c += c
      now.set(code, item)
    }
    ensure(code, account, String(g.direction ?? '借'))
  }
  const list: AccountRow[] = []
  for (const row of acc.values()) {
    const c = cum.get(row.code) ?? { d: 0, c: 0 }
    const n = now.get(row.code) ?? { d: 0, c: 0 }
    const net = (d: number, cr: number) => (row.dir === '借' ? d - cr : cr - d)
    const bal = +(row.open + net(c.d, c.c)).toFixed(2)
    // 期初余额 = 累计余额 - 本期净发生额
    const open = +(bal - net(n.d, n.c)).toFixed(2)
    list.push({ ...row, open, debit: +n.d.toFixed(2), credit: +n.c.toFixed(2), bal })
  }
  return list.sort((a, b) => a.code.localeCompare(b.code))
})

/* ========================================================== 明细联查 */
/** 行项目 → 会计科目编码（用于联查总账） */
const LINE_ACCOUNT: Record<string, string> = {
  货币资金: '1002',
  应收账款: '1122',
  预付款项: '1123',
  其他应收款: '1221',
  存货: '1405',
  固定资产: '1601',
  应付账款: '2202',
  应付职工薪酬: '2211',
  应交税费: '2221',
  主营业务收入: '6001',
  营业收入: '6001',
  营业成本: '6401',
  主营业务成本: '6401',
  销售费用: '6601',
  管理费用: '6602',
}
function accountOf(name: string) {
  const key = name.replace(/^[一二三四五六七八九十]+、/, '').replace(/^(减：|加：)/, '').trim()
  return LINE_ACCOUNT[key] ?? ''
}
/** 打开某个行项目的明细 */
function openLineDetail(line: ReportLine, stmt: string) {
  const code = accountOf(line.name)
  const gl = code
    ? (data.rows('gl') as any[]).filter((g) => String(g.account ?? '').startsWith(code))
    : []
  const sections: PreviewSection[] = [
    {
      title: '行项目',
      type: 'kv',
      rows: [
        { label: '报表', value: stmt },
        { label: '项目名称', value: line.name },
        { label: '行次', value: String(line.line) },
        { label: '本期金额', value: `¥ ${fmt(line.current)}` },
        { label: '上期金额', value: `¥ ${fmt(line.prior)}` },
        { label: '同比', value: yoyOf(line.current, line.prior) },
        { label: '会计期间', value: period.value },
      ],
    },
  ]
  if (gl.length) {
    sections.push({
      title: '相关账簿发生明细',
      type: 'table',
      columns: [
        { key: 'date', title: '日期' },
        { key: 'voucherCode', title: '凭证号' },
        { key: 'summary', title: '摘要' },
        { key: 'account', title: '科目' },
        { key: 'direction', title: '方向' },
        { key: 'debit', title: '借方' },
        { key: 'credit', title: '贷方' },
        { key: 'balance', title: '余额' },
      ],
      data: gl.map((g) => ({
        date: g.date,
        voucherCode: g.voucherCode,
        summary: g.summary,
        account: g.account,
        direction: g.direction,
        debit: fmt(Number(g.debit ?? 0)),
        credit: fmt(Number(g.credit ?? 0)),
        balance: fmt(Number(g.balance ?? 0)),
      })),
    })
  } else {
    sections.push({
      title: '相关账簿发生明细',
      type: 'text',
      text: '该行项目在总账中没有对应的科目发生额，金额由上期结转与本期结转推导。',
    })
  }
  ui.openPreview(`${stmt} · ${line.name}`, {
    title: `${stmt} · ${line.name}`,
    subtitle: `会计期间 ${period.value} · 编制单位：云枢科技（集团）有限公司`,
    sections,
  })
}
/** 打开某个科目的发生明细 */
function openAccountDetail(row: AccountRow) {
  const gl = (data.rows('gl') as any[]).filter((g) => String(g.account ?? '').startsWith(row.code))
  const sections: PreviewSection[] = [
    {
      title: '科目余额',
      type: 'kv',
      rows: [
        { label: '科目编码', value: row.code },
        { label: '科目名称', value: row.name },
        { label: '余额方向', value: row.dir },
        { label: '期初余额', value: `¥ ${fmt(row.open)}` },
        { label: '本期借方发生', value: `¥ ${fmt(row.debit)}` },
        { label: '本期贷方发生', value: `¥ ${fmt(row.credit)}` },
        { label: '期末余额', value: `¥ ${fmt(row.bal)}` },
        { label: '会计期间', value: period.value },
      ],
    },
  ]
  if (gl.length) {
    sections.push({
      title: '账簿发生明细',
      type: 'table',
      columns: [
        { key: 'date', title: '日期' },
        { key: 'voucherCode', title: '凭证号' },
        { key: 'summary', title: '摘要' },
        { key: 'direction', title: '方向' },
        { key: 'debit', title: '借方' },
        { key: 'credit', title: '贷方' },
        { key: 'balance', title: '余额' },
      ],
      data: gl.map((g) => ({
        date: g.date,
        voucherCode: g.voucherCode,
        summary: g.summary,
        direction: g.direction,
        debit: fmt(Number(g.debit ?? 0)),
        credit: fmt(Number(g.credit ?? 0)),
        balance: fmt(Number(g.balance ?? 0)),
      })),
    })
  } else {
    sections.push({
      title: '账簿发生明细',
      type: 'text',
      text: '该科目在当前期间的总账中没有发生额，余额为上期结转。',
    })
  }
  ui.openPreview(`科目余额 · ${row.name}`, {
    title: `科目余额 · ${row.name}`,
    subtitle: `会计期间 ${period.value} · 编制单位：云枢科技（集团）有限公司`,
    sections,
  })
}

/* ========================================================== 导出 */
const statementRows = computed(() => {
  const src =
    activeTab.value === '资产负债表'
      ? [...assets.value, ...liabilities.value, ...equity.value]
      : activeTab.value === '利润表'
        ? income.value
        : cash.value
  return src.map((r) => ({
    name: r.name,
    current: r.current,
    prior: r.prior,
    yoy: yoyOf(r.current, r.prior),
  }))
})

function exportReport() {
  const tab = activeTab.value
  if (tab === '科目余额表') {
    if (!accountRows.value.length) {
      message.warning('当前没有可导出的科目余额数据')
      return
    }
    exportCsv(
      `科目余额表-${period.value}-${stamp()}`,
      [
        { key: 'code', title: '科目编码' },
        { key: 'name', title: '科目名称' },
        { key: 'dir', title: '方向' },
        { key: 'open', title: '期初余额' },
        { key: 'debit', title: '本期借方' },
        { key: 'credit', title: '本期贷方' },
        { key: 'bal', title: '期末余额' },
      ],
      accountRows.value.map((r) => ({ ...r })),
    )
    message.success(`已导出科目余额表（${period.value}）共 ${accountRows.value.length} 个科目`)
    return
  }
  const rows = statementRows.value
  if (!rows.length) {
    message.warning('当前没有可导出的报表数据')
    return
  }
  exportCsv(
    `${tab}-${period.value}-${stamp()}`,
    [
      { key: 'name', title: '项目名称' },
      { key: 'current', title: '本期金额' },
      { key: 'prior', title: '上期金额' },
      { key: 'yoy', title: '同比' },
    ],
    rows,
  )
  message.success(`已导出${tab}（${period.value}）共 ${rows.length} 行`)
}

/* ========================================================== 打印 */
/** 打印视图：只保留报表主体，打印结束后移除 body 上的标记 */
function printReport() {
  const body = document.body
  body.classList.add('printing')
  const cleanup = () => {
    body.classList.remove('printing')
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  window.print()
  // 兜底：个别浏览器不派发 afterprint，打印结束后延时移除打印样式
  setTimeout(cleanup, 2000)
  message.info('已调起打印，可选择打印机或另存为 PDF')
}

/* ========================================================== 趋势与说明 */
const TREND_MONTHS = ['2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10']

const trendOption = computed(() => {
  const revenue = incomeStatement.find((r) => r.name.includes('营业收入'))
  const cost = incomeStatement.find((r) => r.name.includes('营业成本'))
  const toWan = (v: number) => +(v / 10000).toFixed(2)
  const line = (name: string, row: typeof revenue) => ({
    name,
    type: 'line',
    smooth: true,
    symbol: 'circle',
    symbolSize: 6,
    data: TREND_MONTHS.map((m) => (row ? toWan(flowValue(row, m)) : 0)),
    lineStyle: { width: 2.4, color: '#165DFF' },
    itemStyle: { color: '#165DFF' },
  })
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['营业收入', '营业成本'], right: 0, top: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 12, color: '#4E5969' } },
    grid: { left: 8, right: 20, top: 28, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category',
      data: TREND_MONTHS.map((m) => `${Number(m.split('-')[1])}月`),
      axisLine: { lineStyle: { color: '#EDEFF2' } },
      axisTick: { show: false },
      axisLabel: { color: '#86909C', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      name: '万元',
      nameTextStyle: { color: '#86909C', fontSize: 11, padding: [0, 0, 0, 26] },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#F0F1F3' } },
      axisLabel: { color: '#86909C', fontSize: 11 },
    },
    series: [line('营业收入', revenue), line('营业成本', cost)],
  }
})

/**
 * 点趋势图上的某个月 → 切到利润表并把会计期间切到那一个月。
 * 期间取值靠 dataIndex 反查（x 轴标签只有「8月」这种简写，丢了年月）。
 */
function onTrendClick(p: any) {
  const idx = Number(p?.dataIndex)
  const month = TREND_MONTHS[idx]
  if (!month) return
  activeTab.value = '利润表'
  period.value = month
  message.info(`已切换到利润表 · 会计期间 ${month}`)
}

/** 报表说明里的凭证口径（来自凭证库） */
const voucherSummary = computed(() => {
  const list = data.rows('voucher') as any[]
  return {
    total: list.length,
    auto: list.filter((v) => v.source === '业务单据').length,
    manual: list.filter((v) => v.source === '手工录入').length,
    pending: list.filter((v) => ['待审核', '审批中'].includes(String(v.status))).length,
  }
})
</script>

<template>
  <div class="page rep-page">
    <div class="rp-head">
      <div>
        <h1>财务报表</h1>
        <p>资产负债表、利润表、现金流量表与科目余额表</p>
      </div>
      <a-space>
        <a-select v-model:value="period" :options="periodOptions" style="width: 116px" />
        <a-button @click="exportReport">
          <template #icon><AppIcon name="DownloadOutlined" :size="14" /></template>
          导出
        </a-button>
        <a-button @click="printReport">
          <template #icon><AppIcon name="FileTextOutlined" :size="14" /></template>
          打印
        </a-button>
      </a-space>
    </div>

    <div class="card rp-tabs-card">
      <a-tabs v-model:activeKey="activeTab" class="rp-tabs">
        <!-- ============ 资产负债表 ============ -->
        <a-tab-pane key="资产负债表" tab="资产负债表">
          <div class="rp-meta">
            <span>编制单位：云枢科技（集团）有限公司</span>
            <span>会计期间：{{ periodLabel }}</span>
            <span>单位：元</span>
          </div>

          <div class="bs">
            <!-- 资产 -->
            <div class="bs-col">
              <div class="bs-head">资 产</div>
              <table class="rp-table">
                <thead>
                  <tr><th class="w-name">项目</th><th class="w-line">行次</th><th class="r">期末余额</th><th class="r">年初余额</th><th class="w-op">明细</th></tr>
                </thead>
                <tbody>
                  <tr v-for="r in assets" :key="r.line" :class="{ sum: r.sum, total: r.total }">
                    <td>{{ r.name }}</td>
                    <td class="c-line">{{ r.line }}</td>
                    <td class="r num">{{ fmt(r.current) }}</td>
                    <td class="r num dim">{{ fmt(r.prior) }}</td>
                    <td class="c-op"><a class="lk" @click="openLineDetail(r, '资产负债表')">查看</a></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 负债 + 权益 -->
            <div class="bs-col">
              <div class="bs-head">负债和所有者权益</div>
              <table class="rp-table">
                <thead>
                  <tr><th class="w-name">项目</th><th class="w-line">行次</th><th class="r">期末余额</th><th class="r">年初余额</th><th class="w-op">明细</th></tr>
                </thead>
                <tbody>
                  <tr v-for="r in liabilities" :key="'l' + r.line" :class="{ sum: r.sum, total: r.total }">
                    <td>{{ r.name }}</td>
                    <td class="c-line">{{ r.line }}</td>
                    <td class="r num">{{ fmt(r.current) }}</td>
                    <td class="r num dim">{{ fmt(r.prior) }}</td>
                    <td class="c-op"><a class="lk" @click="openLineDetail(r, '资产负债表')">查看</a></td>
                  </tr>
                  <tr v-for="r in equity" :key="'e' + r.line" :class="{ sum: r.sum, total: r.total }">
                    <td>{{ r.name }}</td>
                    <td class="c-line">{{ r.line }}</td>
                    <td class="r num">{{ fmt(r.current) }}</td>
                    <td class="r num dim">{{ fmt(r.prior) }}</td>
                    <td class="c-op"><a class="lk" @click="openLineDetail(r, '资产负债表')">查看</a></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="rp-check" :class="{ warn: Math.abs(balanceDiff) > 0.01 }">
            <AppIcon :name="Math.abs(balanceDiff) > 0.01 ? 'ExclamationCircleOutlined' : 'CheckCircleOutlined'" :size="14" />
            平衡校验{{ Math.abs(balanceDiff) > 0.01 ? '未通过' : '通过' }}：资产总计 ¥ {{ fmt(assetTotal) }}
            = 负债和所有者权益总计 ¥ {{ fmt(liabilityTotal + equityTotal) }}
            <template v-if="Math.abs(balanceDiff) > 0.01">（差额 ¥ {{ fmt(balanceDiff) }}）</template>
          </div>
        </a-tab-pane>

        <!-- ============ 利润表 ============ -->
        <a-tab-pane key="利润表" tab="利润表">
          <div class="rp-meta">
            <span>编制单位：云枢科技（集团）有限公司</span>
            <span>会计期间：{{ periodLabel }}</span>
            <span>单位：元</span>
          </div>
          <div class="is-wrap">
            <table class="rp-table rp-table-solo">
              <thead>
                <tr><th class="w-name">项目</th><th class="w-line">行次</th><th class="r">本期金额</th><th class="r">上期金额</th><th class="r">同比</th><th class="w-op">明细</th></tr>
              </thead>
              <tbody>
                <tr v-for="r in income" :key="r.line" :class="{ sum: r.sum, total: r.total, focus: isFocused(r.name) }">
                  <td>{{ r.name }}</td>
                  <td class="c-line">{{ r.line }}</td>
                  <td class="r num">{{ fmt(r.current) }}</td>
                  <td class="r num dim">{{ fmt(r.prior) }}</td>
                  <td class="r num">{{ yoyOf(r.current, r.prior) }}</td>
                  <td class="c-op"><a class="lk" @click="openLineDetail(r, '利润表')">查看</a></td>
                </tr>
              </tbody>
            </table>
          </div>
        </a-tab-pane>

        <!-- ============ 现金流量表 ============ -->
        <a-tab-pane key="现金流量表" tab="现金流量表">
          <div class="rp-meta">
            <span>编制单位：云枢科技（集团）有限公司</span>
            <span>会计期间：{{ periodLabel }}</span>
            <span>单位：元</span>
          </div>
          <div class="is-wrap">
            <table class="rp-table rp-table-solo">
              <thead>
                <tr><th class="w-name">项目</th><th class="w-line">行次</th><th class="r">本期金额</th><th class="r">上期金额</th><th class="r">同比</th><th class="w-op">明细</th></tr>
              </thead>
              <tbody>
                <tr v-for="r in cash" :key="r.line" :class="{ sum: r.sum, total: r.total, group: r.group }">
                  <td>{{ r.name }}</td>
                  <td class="c-line">{{ r.line }}</td>
                  <td class="r num">{{ fmt(r.current) }}</td>
                  <td class="r num dim">{{ fmt(r.prior) }}</td>
                  <td class="r num">{{ yoyOf(r.current, r.prior) }}</td>
                  <td class="c-op"><a class="lk" @click="openLineDetail(r, '现金流量表')">查看</a></td>
                </tr>
              </tbody>
            </table>
          </div>
        </a-tab-pane>

        <!-- ============ 科目余额表 ============ -->
        <a-tab-pane key="科目余额表" tab="科目余额表">
          <div class="rp-meta">
            <span>会计期间：{{ periodLabel }}</span>
            <span>单位：元</span>
            <span>发生额来源：总账明细</span>
          </div>
          <a-table
            :data-source="accountRows"
            :pagination="false"
            size="small"
            row-key="code"
          >
            <a-table-column key="code" title="科目编码" data-index="code" width="110" />
            <a-table-column key="name" title="科目名称" data-index="name" width="160" />
            <a-table-column key="dir" title="方向" data-index="dir" width="70" align="center" />
            <a-table-column key="open" title="期初余额" data-index="open" align="right" width="140">
              <template #default="{ record }">{{ fmt(record.open) }}</template>
            </a-table-column>
            <a-table-column key="debit" title="本期借方" data-index="debit" align="right" width="140">
              <template #default="{ record }">{{ fmt(record.debit) }}</template>
            </a-table-column>
            <a-table-column key="credit" title="本期贷方" data-index="credit" align="right" width="140">
              <template #default="{ record }">{{ fmt(record.credit) }}</template>
            </a-table-column>
            <a-table-column key="bal" title="期末余额" data-index="bal" align="right" width="150">
              <template #default="{ record }"><b>{{ fmt(record.bal) }}</b></template>
            </a-table-column>
            <a-table-column key="op" title="明细" width="80">
              <template #default="{ record }"><a class="lk" @click="openAccountDetail(record)">查看</a></template>
            </a-table-column>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </div>

    <div class="fo-grid rp-bottom">
      <div class="card col2">
        <div class="card-hd"><h3>近 6 期收入与成本<span class="chart-tip">点击月份切换利润表期间</span></h3></div>
        <div class="card-bd"><BaseChart :option="trendOption" :height="230" clickable @point-click="onTrendClick" /></div>
      </div>
      <div class="card">
        <div class="card-hd"><h3>报表说明</h3></div>
        <div class="card-bd rp-notes">
          <div class="note"><i />编制基础：企业会计准则（2024 修订）</div>
          <div class="note"><i />记账本位币：人民币 CNY</div>
          <div class="note"><i />报表期间：{{ period }} · 凭证 {{ voucherSummary.total }} 张</div>
          <div class="note"><i />生成方式：业务单据自动结转 {{ voucherSummary.auto }} 张 + 手工录入 {{ voucherSummary.manual }} 张</div>
          <div v-if="voucherSummary.pending" class="note warn"><i />提示：本期尚有 {{ voucherSummary.pending }} 张凭证待审核</div>
          <div v-else class="note"><i />提示：本期凭证已全部审核</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rep-page { display: flex; flex-direction: column; gap: 12px; }
.rp-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.rp-head h1 { margin: 0 0 5px; font-size: 20px; font-weight: 600; }
.rp-head p { margin: 0; font-size: 13px; color: var(--text-3); }

.rp-tabs-card { padding: 0 20px 18px; }
.rp-tabs { margin-bottom: 0; }
.rp-meta {
  display: flex; gap: 26px; justify-content: flex-end;
  font-size: 12px; color: var(--text-3); padding: 6px 0 12px;
  border-bottom: 1px solid var(--border-subtle); margin-bottom: 4px;
}

.bs { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding-top: 8px; }
.bs-col { min-width: 0; }
.bs-head {
  text-align: center; font-size: 13.5px; font-weight: 600; color: var(--text-1);
  padding: 8px 0; background: var(--surface-sunken); border: 1px solid var(--border);
  border-radius: var(--r-md) var(--r-md) 0 0; letter-spacing: 2px;
}

.rp-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.rp-table th {
  background: var(--surface-sunken); color: var(--text-2); font-weight: 500;
  padding: 8px 10px; border: 1px solid var(--border); text-align: left; white-space: nowrap;
}
.rp-table td { padding: 6px 10px; border: 1px solid var(--border-subtle); color: var(--text-1); }
.rp-table .r { text-align: right; font-variant-numeric: tabular-nums; }
.rp-table .num { font-variant-numeric: tabular-nums; }
.rp-table .dim { color: var(--text-3); }
.rp-table .w-name { width: auto; }
.rp-table .w-line { width: 52px; text-align: center; }
.rp-table .w-op { width: 52px; text-align: center; }
.rp-table .c-line { text-align: center; color: var(--text-4); font-variant-numeric: tabular-nums; }
.rp-table .c-op { text-align: center; }
.rp-table tr.sum td { font-weight: 600; background: #FAFBFC; }
.rp-table tr.total td { font-weight: 600; background: var(--brand-050); color: var(--brand-700); }
.rp-table tr.group td { font-weight: 600; }
/* 深链定位到的行：淡蓝底 + 左侧色条，滚动过来一眼能看到 */
.rp-table tr.focus td { background: var(--brand-050); }
.rp-table tr.focus td:first-child { box-shadow: inset 3px 0 0 var(--brand-500); font-weight: 600; }
.rp-table tbody tr:hover td { background: var(--surface-hover); }
.lk { color: var(--brand-600); cursor: pointer; }
.lk:hover { color: var(--brand-700); text-decoration: underline; }

.is-wrap { padding-top: 8px; }
.rp-table-solo { max-width: 960px; }

.rp-check {
  display: flex; align-items: center; gap: 7px; margin-top: 14px;
  font-size: 12.5px; color: var(--success);
  background: var(--success-bg); padding: 8px 12px; border-radius: var(--r-md);
}
.rp-check.warn { color: var(--danger); background: var(--danger-bg); }

.fo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.col2 { grid-column: span 2; }
.rp-notes { display: flex; flex-direction: column; gap: 11px; }
.note { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text-2); }
.note i { width: 6px; height: 6px; border-radius: 50%; background: var(--brand-500); flex: none; }
.note.warn { color: var(--warning); }
.note.warn i { background: var(--warning); }

@media (max-width: 1240px) {
  .bs { grid-template-columns: 1fr; }
  .fo-grid { grid-template-columns: 1fr; }
  .col2 { grid-column: span 1; }
}
</style>

<style>
/* ------------------------------------------------------------------
   打印视图：body 上带 .printing 时只保留报表主体
   （侧栏、顶栏、页签栏、图表与操作按钮都不参与打印）
   ------------------------------------------------------------------ */
@media print {
  body.printing .app-sider,
  body.printing .app-header,
  body.printing .app-tabs {
    display: none !important;
  }
  body.printing .app-content {
    background: #fff !important;
    overflow: visible !important;
    height: auto !important;
  }
  body.printing .rp-head .ant-space,
  body.printing .rp-bottom,
  body.printing .rp-tabs > .ant-tabs-nav {
    display: none !important;
  }
  body.printing .ant-tabs-tabpane-hidden {
    display: none !important;
  }
  body.printing .rp-tabs-card {
    padding: 0 !important;
  }
  body.printing .card {
    box-shadow: none !important;
    break-inside: avoid;
  }
  body.printing .rp-table th,
  body.printing .rp-table td {
    border-color: #b9bec7 !important;
  }
}
</style>
