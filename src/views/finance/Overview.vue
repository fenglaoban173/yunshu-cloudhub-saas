<script setup lang="ts">
/**
 * 财务中心 · 工作台（应用域落地页）
 * 进入财务系统的默认首页：收入利润、资金账户与期间任务。
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseChart from '@/components/BaseChart.vue'
import AppIcon from '@/components/AppIcon.vue'
import QuickLinks from '@/components/QuickLinks.vue'
import { financeOverview } from '@/mock/finance'
import { chartName, drillTo } from '@/utils/drill'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'

const router = useRouter()
const data = useDataStore()
const ui = useUiStore()

/** 当前账套（切换后下方账户与应收按账套口径展示） */
const bookset = ref('云枢科技集团本部账套')
/** 账套取自真实的账套数据，只展示启用中的 */
const booksets = computed(() =>
  data.rows('bookset').filter((b: any) => b.status === '使用中').map((b: any) => b.name),
)
const currentBook = computed(() =>
  data.rows('bookset').find((b: any) => b.name === bookset.value),
)

/** 应用域主题色：财务橙 */
const COLOR = '#FF7D00'

const quick = [
  { label: '录入凭证', icon: 'FormOutlined', path: '/finance/voucher/new' },
  { label: '应收管理', icon: 'DownloadOutlined', path: '/finance/ar' },
  { label: '银行流水', icon: 'SwapOutlined', path: '/finance/flow' },
  { label: '财务报表', icon: 'BarChartOutlined', path: '/finance/report' },
  { label: '期末结账', icon: 'LockOutlined', path: '/finance/close' },
]

const kpis = computed(() => [
  { label: '营业收入（本期）', value: '¥ 3,148.6 万', sub: '上年同期 ¥ 2,164.1 万', trend: 45.4, icon: 'RiseOutlined', tone: 'brand' },
  { label: '净利润（本期）', value: '¥ 81.5 万', sub: '净利率 2.59%', trend: 766.5, icon: 'GoldOutlined', tone: 'success' },
  { label: '毛利率', value: '69.6%', sub: '上年同期 70.3%', trend: -0.7, icon: 'PieChartOutlined', tone: 'brand' },
  {
    label: '应收余额',
    value: `¥ ${(arTotal.value / 10000).toFixed(1)} 万`,
    sub: '实时取自应收管理',
    trend: 25.6,
    icon: 'DownloadOutlined',
    tone: 'danger',
  },
])

const trendOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { data: ['收入', '成本', '毛利'], right: 0, top: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 12, color: '#4E5969' } },
  xAxis: {
    type: 'category', data: financeOverview.trend.map((t) => t.m),
    axisLine: { lineStyle: { color: '#EDEFF2' } }, axisTick: { show: false },
    axisLabel: { color: '#86909C', fontSize: 11 },
  },
  yAxis: {
    type: 'value', name: '万元', nameTextStyle: { color: '#86909C', fontSize: 11, padding: [0, 0, 0, 26] },
    axisLine: { show: false }, axisTick: { show: false },
    splitLine: { lineStyle: { color: '#F0F1F3' } }, axisLabel: { color: '#86909C', fontSize: 11 },
  },
  series: [
    { name: '收入', type: 'bar', barWidth: 14, data: financeOverview.trend.map((t) => t.income), itemStyle: { color: '#FF7D00', borderRadius: [3, 3, 0, 0] } },
    { name: '成本', type: 'bar', barWidth: 14, data: financeOverview.trend.map((t) => t.cost), itemStyle: { color: '#FFC266', borderRadius: [3, 3, 0, 0] } },
    { name: '毛利', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, data: financeOverview.trend.map((t) => t.profit), lineStyle: { width: 2.4, color: '#00B42A' }, itemStyle: { color: '#00B42A' } },
  ],
}))

const costOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}<br/>¥ {c} ({d}%)' },
  legend: { bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { fontSize: 12, color: '#4E5969' } },
  series: [{
    type: 'pie', radius: ['46%', '68%'], center: ['50%', '42%'],
    color: ['#FF7D00', '#FFC266', '#FFE0B2', '#14C9C9'],
    itemStyle: { borderColor: '#fff', borderWidth: 2 }, label: { show: false },
    data: financeOverview.costStructure.map((c) => ({ name: c.name, value: c.value })),
  }],
}))

const revOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 8, right: 16, top: 20, bottom: 4, containLabel: true },
  xAxis: {
    type: 'category', data: financeOverview.structure.map((s) => s.name),
    axisLine: { lineStyle: { color: '#EDEFF2' } }, axisTick: { show: false },
    axisLabel: { color: '#86909C', fontSize: 11, interval: 0 },
  },
  yAxis: {
    type: 'value', axisLine: { show: false }, axisTick: { show: false },
    splitLine: { lineStyle: { color: '#F0F1F3' } }, axisLabel: { color: '#86909C', fontSize: 11 },
  },
  series: [{
    type: 'bar', barWidth: 26,
    itemStyle: { color: '#FF7D00', borderRadius: [4, 4, 0, 0] },
    data: financeOverview.structure.map((s) => s.value),
  }],
}))

/* ---------------- 图表下钻 ---------------- */
/** 收入 / 成本 / 毛利趋势 → 利润表 */
function onTrendClick() {
  drillTo(router, '/finance/report', { tab: '利润表' }, '已跳转到财务 · 利润表')
}

/** 成本费用结构 → 利润表，并定位到对应科目行（研发费用 / 销售费用 …） */
function onCostClick(p: any) {
  const name = chartName(p)
  if (!name) return
  drillTo(router, '/finance/report', { tab: '利润表', focus: name }, `已跳转到利润表 · ${name}`)
}

/** 收入构成 → 利润表 */
function onRevClick(p: any) {
  const name = chartName(p)
  if (!name) return
  drillTo(router, '/finance/report', { tab: '利润表', focus: name }, `已跳转到利润表 · ${name}`)
}

const tasks = [
  { name: '2025-10 期末结账', desc: '云枢科技集团本部账套', deadline: '2025-10-28', status: '进行中', tone: 'processing', path: '/finance/close' },
  { name: '增值税申报', desc: '2025 年 10 月所属期', deadline: '2025-11-15', status: '待处理', tone: 'warning', path: '/finance/tax' },
  { name: '银行流水导入', desc: '中国银行·基本户', deadline: '2025-10-28', status: '待处理', tone: 'warning', path: '/finance/flow' },
  { name: '固定资产折旧计提', desc: '2025 年 10 月', deadline: '2025-10-31', status: '待处理', tone: 'warning', path: '/finance/asset' },
  { name: '成本中心预算调整', desc: '研发中心 Q4', deadline: '2025-11-05', status: '待处理', tone: 'default', path: '/finance/budget' },
]

/** 资金账户 / 逾期应收 —— 读实时仓库；资金账户按当前账套的币种过滤 */
const bankRows = computed(() => {
  const cur = currentBook.value?.currency
  const rows = data.rows('bank')
  return (cur ? rows.filter((b: any) => b.currency === cur) : rows).slice(0, 4)
})
const overdueAr = computed(() =>
  data.rows('ar').filter((a: any) => a.status === '已逾期').slice(0, 5),
)
const arTotal = computed(() =>
  data.rows('ar').reduce((s: number, a: any) => s + Number(a.balance ?? 0), 0),
)
</script>

<template>
  <div class="page fin-ov">
    <div class="fo-head">
      <div>
        <h1>工作台</h1>
        <p>财务中心 · 收入利润、资金与期间任务全景</p>
      </div>
      <a-space>
        <a-select v-model:value="bookset" :options="booksets.map(v => ({ label: v, value: v }))" style="width: 210px" />
        <a-button type="primary" @click="router.push('/finance/report')">
          <template #icon><AppIcon name="BarChartOutlined" :size="14" /></template>
          查看报表
        </a-button>
      </a-space>
    </div>

    <QuickLinks :items="quick" :color="COLOR" />

    <div class="fo-kpi">
      <div v-for="k in kpis" :key="k.label" class="fk">
        <span class="fk-ico" :class="k.tone"><AppIcon :name="k.icon" :size="15" /></span>
        <div class="fk-main">
          <div class="fk-label">{{ k.label }}</div>
          <div class="fk-val num">{{ k.value }}</div>
          <div class="fk-sub">
            {{ k.sub }}
            <span class="fk-trend" :class="k.trend >= 0 ? 'up' : 'down'">
              <AppIcon :name="k.trend >= 0 ? 'RiseOutlined' : 'FallOutlined'" :size="10" />
              {{ Math.abs(k.trend) }}%
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="fo-grid">
      <div class="card col2">
        <div class="card-hd"><h3>收入成本与毛利<span class="chart-tip">点击查看利润表</span></h3></div>
        <div class="card-bd"><BaseChart :option="trendOption" :height="272" clickable @point-click="onTrendClick" /></div>
      </div>
      <div class="card">
        <div class="card-hd"><h3>成本费用结构<span class="chart-tip">点击定位到利润表科目</span></h3></div>
        <div class="card-bd"><BaseChart :option="costOption" :height="272" clickable @point-click="onCostClick" /></div>
      </div>
    </div>

    <div class="fo-grid">
      <div class="card">
        <div class="card-hd"><h3>收入构成<span class="chart-tip">点击查看利润表</span></h3></div>
        <div class="card-bd"><BaseChart :option="revOption" :height="240" clickable @point-click="onRevClick" /></div>
      </div>

      <div class="card">
        <div class="card-hd">
          <h3>资金账户余额</h3>
          <a class="more" @click="router.push('/finance/bank')">全部账户</a>
        </div>
        <div class="card-bd" style="padding: 8px 0">
          <div v-for="b in bankRows" :key="b.id" class="bk" @click="ui.openDetail('bank', b)">
            <span class="bk-ico"><AppIcon name="BankOutlined" :size="14" /></span>
            <div class="bk-main">
              <div class="bk-name">{{ b.name }}</div>
              <div class="bk-no">{{ b.account }}</div>
            </div>
            <div class="bk-right">
              <div class="bk-bal num">{{ b.currency === 'USD' ? '$' : '¥' }} {{ b.balance.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</div>
              <div class="bk-sync">对账至 {{ b.reconcile }}</div>
            </div>
          </div>
          <a-empty
            v-if="!bankRows.length"
            description="该账套币种下暂无资金账户"
            style="padding: 18px 0"
          />
        </div>
      </div>

      <div class="card">
        <div class="card-hd"><h3>期间任务</h3><span class="cnt">5 项待办</span></div>
        <div class="card-bd" style="padding: 8px 0">
          <div v-for="t in tasks" :key="t.name" class="tk" @click="router.push(t.path)">
            <a-tag :color="t.tone" :bordered="false">{{ t.status }}</a-tag>
            <div class="tk-main">
              <div class="tk-name">{{ t.name }}</div>
              <div class="tk-meta">{{ t.desc }} · 截止 {{ t.deadline }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-hd">
        <h3>逾期应收预警</h3>
        <a class="more" @click="router.push('/finance/ar')">进入应收管理</a>
      </div>
      <div class="card-bd" style="padding: 0">
        <a-table :data-source="overdueAr" :pagination="false" size="small" row-key="id">
          <a-table-column key="customer" title="客户" data-index="customer" />
          <a-table-column key="contract" title="合同号" data-index="contract" width="120" />
          <a-table-column key="balance" title="逾期金额" data-index="balance" align="right" width="140">
            <template #default="{ record }">¥ {{ record.balance.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</template>
          </a-table-column>
          <a-table-column key="ageDays" title="账龄(天)" data-index="ageDays" align="right" width="100" />
          <a-table-column key="owner" title="负责人" data-index="owner" width="100" />
          <a-table-column key="dueDate" title="到期日" data-index="dueDate" width="120" />
        </a-table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fin-ov { display: flex; flex-direction: column; gap: 12px; }
.fo-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.fo-head h1 { margin: 0 0 5px; font-size: 20px; font-weight: 600; }
.fo-head p { margin: 0; font-size: 13px; color: var(--text-3); }
.more { font-size: 12.5px; color: var(--text-3); cursor: pointer; }
.more:hover { color: var(--brand-600); }
.cnt { font-size: 12px; color: var(--text-3); }

.fo-kpi { display: grid; grid-template-columns: repeat(auto-fit, minmax(232px, 1fr)); gap: 12px; }
.fk {
  display: flex; gap: 12px; align-items: flex-start;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: 15px 16px; box-shadow: var(--shadow-card);
}
.fk-ico { width: 36px; height: 36px; border-radius: var(--r-md); display: flex; align-items: center; justify-content: center; flex: none; }
.fk-ico.brand { background: #ff7d0014; color: #ff7d00; }
.fk-ico.success { background: var(--success-bg); color: var(--success); }
.fk-ico.danger { background: var(--danger-bg); color: var(--danger); }
.fk-label { font-size: 12px; color: var(--text-3); }
.fk-val { font-size: 21px; font-weight: 600; margin: 3px 0 5px; }
.fk-sub { font-size: 11.5px; color: var(--text-3); display: flex; align-items: center; gap: 7px; }
.fk-trend { display: inline-flex; align-items: center; gap: 2px; font-weight: 500; }
.fk-trend.up { color: var(--danger); }
.fk-trend.down { color: var(--success); }

.fo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.col2 { grid-column: span 2; }

.bk { display: flex; align-items: center; gap: 10px; padding: 10px 18px; }
.bk-ico { width: 28px; height: 28px; border-radius: var(--r-sm); background: var(--neutral-bg); color: var(--text-2); display: flex; align-items: center; justify-content: center; flex: none; }
.bk-main { flex: 1; min-width: 0; }
.bk-name { font-size: 13px; color: var(--text-1); }
.bk-no { font-size: 11px; color: var(--text-4); font-variant-numeric: tabular-nums; margin-top: 1px; }
.bk-right { text-align: right; flex: none; }
.bk-bal { font-size: 13.5px; font-weight: 600; }
.bk-sync { font-size: 11px; color: var(--text-3); margin-top: 2px; }

.tk { display: flex; align-items: center; gap: 10px; padding: 9px 18px; }
.tk-main { min-width: 0; }
.tk-name { font-size: 13px; color: var(--text-1); }
.tk-meta { font-size: 11.5px; color: var(--text-3); margin-top: 2px; }

@media (max-width: 1280px) { .fo-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
