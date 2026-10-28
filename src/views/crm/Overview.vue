<script setup lang="ts">
/**
 * CRM 客户关系 · 工作台（应用域落地页）
 * 进入 CRM 系统的默认首页：管道健康度、团队业绩与重点客户。
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import BaseChart from '@/components/BaseChart.vue'
import AppIcon from '@/components/AppIcon.vue'
import QuickLinks from '@/components/QuickLinks.vue'
import { crmOverview } from '@/mock/crm'
import { chartName, drillTo } from '@/utils/drill'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import { useAction } from '@/composables/useAction'

const router = useRouter()
const data = useDataStore()
const ui = useUiStore()
const { run } = useAction()

/** 应用域主题色：CRM 蓝 */
const COLOR = '#165DFF'

const quick = [
  { label: '新建商机', icon: 'SolutionOutlined', path: '/crm/opportunity' },
  { label: '商机看板', icon: 'PartitionOutlined', path: '/crm/kanban' },
  { label: '客户 360', icon: 'UserOutlined', path: '/crm/account/360' },
  { label: '销售漏斗', icon: 'FilterOutlined', path: '/crm/funnel' },
  { label: '销售目标', icon: 'AimOutlined', path: '/crm/target' },
]

/**
 * 工作台 KPI：全部读实时仓库，别处新建 / 推进的商机与线索会立刻反映到这里。
 * （口径与商机看板一致：在途 = 阶段未到「合同签署」；赢单率 = 已成交 / 全部商机）
 */
const kpis = computed<{ label: string; value: string; icon: string; tone: string; sub: string; trend?: number }[]>(() => {
  const opps = data.rows('opportunity') as any[]
  const leads = data.rows('lead') as any[]
  const inflight = opps.filter((o) => o.stage !== '合同签署')
  const pipeline = inflight.reduce((s, o) => s + Number(o.amount ?? 0), 0)
  const weighted = inflight.reduce((s, o) => s + (Number(o.amount ?? 0) * Number(o.probability ?? 0)) / 100, 0)
  const won = opps.filter((o) => o.stage === '合同签署')
  const winRate = opps.length ? (won.length / opps.length) * 100 : 0
  const avgRate = pipeline ? (weighted / pipeline) * 100 : 0
  const valid = leads.filter((l) => l.status !== '已废弃')
  const converted = valid.filter((l) => l.status === '已转化')
  const convRate = valid.length ? (converted.length / valid.length) * 100 : 0
  return [
    { label: '在途商机', value: `${inflight.length} 个`, icon: 'PartitionOutlined', tone: 'brand', sub: `管道总额 ¥ ${pipeline.toFixed(1)} 万` },
    { label: '加权预测', value: `¥ ${weighted.toFixed(1)} 万`, icon: 'RiseOutlined', tone: 'success', sub: `平均赢率 ${avgRate.toFixed(1)}%` },
    { label: '赢单率', value: `${winRate.toFixed(1)}%`, icon: 'TrophyOutlined', tone: 'warning', sub: `已成交 ${won.length} 个商机` },
    { label: '新增线索', value: `${valid.length} 条`, icon: 'TagsOutlined', tone: 'brand', sub: `已转化 ${converted.length} 条` },
    { label: '线索转化率', value: `${convRate.toFixed(1)}%`, icon: 'ThunderboltOutlined', tone: 'success', sub: '目标 20%' },
  ]
})

const trendOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { data: ['目标', '实际'], right: 0, top: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 12, color: '#4E5969' } },
  xAxis: {
    type: 'category', data: crmOverview.monthly.map((m) => m.m),
    axisLine: { lineStyle: { color: '#EDEFF2' } }, axisTick: { show: false },
    axisLabel: { color: '#86909C', fontSize: 11 },
  },
  yAxis: {
    type: 'value', name: '万元', nameTextStyle: { color: '#86909C', fontSize: 11, padding: [0, 0, 0, 26] },
    axisLine: { show: false }, axisTick: { show: false },
    splitLine: { lineStyle: { color: '#F0F1F3' } }, axisLabel: { color: '#86909C', fontSize: 11 },
  },
  series: [
    { name: '目标', type: 'bar', barWidth: 13, data: crmOverview.monthly.map((m) => m.target), itemStyle: { color: '#E8EAED', borderRadius: [3, 3, 0, 0] } },
    { name: '实际', type: 'bar', barWidth: 13, data: crmOverview.monthly.map((m) => m.actual), itemStyle: { color: '#165DFF', borderRadius: [3, 3, 0, 0] } },
  ],
}))

const sourceOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}<br/>{c} 条 ({d}%)' },
  legend: { bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { fontSize: 12, color: '#4E5969' } },
  series: [{
    type: 'pie', radius: ['48%', '70%'], center: ['50%', '42%'],
    itemStyle: { borderColor: '#fff', borderWidth: 2 }, label: { show: false },
    data: crmOverview.source.map((s) => ({ name: s.name, value: s.value })),
  }],
}))

/* ---------------- 图表下钻 ---------------- */
/** 月度目标 → 销售目标明细 */
function onTrendClick() {
  drillTo(router, '/crm/target', {}, '已跳转到销售目标明细')
}

/** 线索来源 → 线索管理，并把来源带到关键词里（列表页自动套用筛选） */
function onSourceClick(p: any) {
  const name = chartName(p)
  if (!name) return
  drillTo(router, '/crm/lead', { keyword: name }, `已跳转到线索管理 · 来源「${name}」`)
}

/** 重点商机 / 战略客户 / 团队目标 —— 读实时仓库，别处改动后这里同步 */
const hotOpps = computed(() =>
  [...data.rows('opportunity')].sort((a: any, b: any) => b.amount - a.amount).slice(0, 6),
)
const hotAccounts = computed(() =>
  [...data.rows('account')].sort((a: any, b: any) => b.contractValue - a.contractValue).slice(0, 6),
)
const targetRows = computed(() => data.rows('target').slice(0, 7))
</script>

<template>
  <div class="page crm-ov">
    <div class="ov-head">
      <div>
        <h1>工作台</h1>
        <p>CRM 客户关系 · 销售管道与团队业绩全景</p>
      </div>
      <a-space>
        <a-button @click="router.push('/crm/kanban')">进入商机看板</a-button>
        <a-button type="primary" @click="run('新建商机', { pageKey: 'opportunity' })">
          <template #icon><AppIcon name="PlusOutlined" :size="14" /></template>
          新建商机
        </a-button>
      </a-space>
    </div>

    <QuickLinks :items="quick" :color="COLOR" />

    <div class="kpi5">
      <div v-for="k in kpis" :key="k.label" class="k5">
        <div class="k5-top">
          <span>{{ k.label }}</span>
          <span class="k5-ico" :class="k.tone"><AppIcon :name="k.icon" :size="14" /></span>
        </div>
        <div class="k5-val">{{ k.value }}</div>
        <div class="k5-bot">
          <span class="k5-sub">{{ k.sub }}</span>
          <span v-if="k.trend !== undefined" class="k5-trend" :class="k.trend >= 0 ? 'up' : 'down'">
            {{ k.trend >= 0 ? '+' : '' }}{{ k.trend }}%
          </span>
        </div>
      </div>
    </div>

    <div class="ov-grid">
      <div class="card col2">
        <div class="card-hd"><h3>月度目标完成情况<span class="chart-tip">点击查看销售目标明细</span></h3></div>
        <div class="card-bd"><BaseChart :option="trendOption" :height="270" clickable @point-click="onTrendClick" /></div>
      </div>
      <div class="card">
        <div class="card-hd"><h3>线索来源<span class="chart-tip">点击来源筛选线索</span></h3></div>
        <div class="card-bd"><BaseChart :option="sourceOption" :height="270" clickable @point-click="onSourceClick" /></div>
      </div>
    </div>

    <div class="ov-grid">
      <div class="card">
        <div class="card-hd">
          <h3>重点商机</h3>
          <a class="more" @click="router.push('/crm/opportunity')">全部</a>
        </div>
        <div class="card-bd" style="padding: 6px 0">
          <div v-for="o in hotOpps" :key="o.id" class="row" @click="ui.openDetail('opportunity', o)">
            <div class="row-main">
              <div class="row-t ellipsis">{{ o.name }}</div>
              <div class="row-s">{{ o.owner }} · {{ o.expectedClose }}</div>
            </div>
            <div class="row-right">
              <div class="row-amt num">¥ {{ o.amount.toFixed(1) }} 万</div>
              <a-tag color="processing" :bordered="false" style="margin-top: 3px">{{ o.stage }}</a-tag>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-hd">
          <h3>战略客户</h3>
          <a class="more" @click="router.push('/crm/account')">全部</a>
        </div>
        <div class="card-bd" style="padding: 6px 0">
          <div v-for="a in hotAccounts" :key="a.id" class="row" @click="ui.openDetail('account', a)">
            <div class="row-main">
              <div class="row-t ellipsis">{{ a.name }}</div>
              <div class="row-s">{{ a.industry }} · {{ a.city }} · 负责人 {{ a.owner }}</div>
            </div>
            <div class="row-right">
              <div class="row-amt num">¥ {{ a.contractValue.toFixed(0) }} 万</div>
              <a-tag color="error" :bordered="false" style="margin-top: 3px">{{ a.level }}</a-tag>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-hd"><h3>团队目标完成</h3></div>
        <div class="card-bd" style="padding: 10px 20px 16px">
          <div v-for="t in targetRows" :key="t.id" class="tgt">
            <span class="tgt-name">{{ t.owner }}</span>
            <a-progress
              :percent="Math.min(100, t.rate)"
              size="small"
              :stroke-color="t.rate >= 100 ? '#00B42A' : t.rate >= 80 ? '#165DFF' : '#FF7D00'"
            />
            <span class="tgt-val num">{{ t.rate }}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.crm-ov { display: flex; flex-direction: column; gap: 12px; }
.ov-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.ov-head h1 { margin: 0 0 5px; font-size: 20px; font-weight: 600; }
.ov-head p { margin: 0; font-size: 13px; color: var(--text-3); }

.kpi5 { display: grid; grid-template-columns: repeat(auto-fit, minmax(198px, 1fr)); gap: 12px; }
.k5 {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg);
  padding: 14px 15px; box-shadow: var(--shadow-card);
}
.k5-top { display: flex; align-items: center; justify-content: space-between; font-size: 12.5px; color: var(--text-3); }
.k5-ico { width: 26px; height: 26px; border-radius: var(--r-sm); display: flex; align-items: center; justify-content: center; }
.k5-ico.brand { background: var(--brand-050); color: var(--brand-600); }
.k5-ico.success { background: var(--success-bg); color: var(--success); }
.k5-ico.warning { background: var(--warning-bg); color: var(--warning); }
.k5-val { font-size: 22px; font-weight: 600; margin: 8px 0 7px; font-variant-numeric: tabular-nums; }
.k5-bot { display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; }
.k5-sub { color: var(--text-3); }
.k5-trend { font-weight: 500; }
.k5-trend.up { color: var(--danger); }
.k5-trend.down { color: var(--success); }

.ov-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.col2 { grid-column: span 2; }
.more { font-size: 12.5px; color: var(--text-3); cursor: pointer; }
.more:hover { color: var(--brand-600); }

.row {
  display: flex; align-items: center; justify-content: space-between; gap: 14px;
  padding: 10px 20px; cursor: pointer;
  transition: background-color var(--dur-base) var(--ease);
}
.row:hover { background: var(--surface-hover); }
.row-main { min-width: 0; }
.row-t { font-size: 13px; color: var(--text-1); margin-bottom: 3px; }
.row-s { font-size: 11.5px; color: var(--text-3); }
.row-right { text-align: right; flex: none; display: flex; flex-direction: column; align-items: flex-end; }
.row-amt { font-size: 14px; font-weight: 600; }

.tgt { display: grid; grid-template-columns: 56px 1fr 52px; align-items: center; gap: 10px; margin-bottom: 11px; }
.tgt-name { font-size: 12.5px; color: var(--text-2); }
.tgt-val { font-size: 12.5px; text-align: right; color: var(--text-1); font-weight: 500; }

@media (max-width: 1280px) { .ov-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
