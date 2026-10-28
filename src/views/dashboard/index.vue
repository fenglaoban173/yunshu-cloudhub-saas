<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseChart from '@/components/BaseChart.vue'
import AppIcon from '@/components/AppIcon.vue'
import { useUserStore } from '@/stores/user'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import { useAction } from '@/composables/useAction'
import { appOfPath } from '@/config/menu'
import { crmOverview } from '@/mock/crm'
import { chartName, drillTo } from '@/utils/drill'

const router = useRouter()
const user = useUserStore()
const data = useDataStore()
const ui = useUiStore()
const { run } = useAction()
const range = ref('近 12 个月')

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

/** 待我审批 / 公告 —— 读实时仓库 */
const pendingTodos = computed(() =>
  data.rows('approval').filter((a: any) => a.status === '审批中'),
)
const overdueAr = computed(() =>
  data.rows('ar').filter((a: any) => a.status === '已逾期'),
)

const kpis = computed(() => [
  { label: '本月营收', value: '¥ 3,148.6 万', trend: 11.2, unit: '', icon: 'RiseOutlined', tone: 'brand', sub: '目标完成 84.2%' },
  {
    label: '在途商机',
    value: '¥ 9,640 万',
    trend: 6.8,
    icon: 'SolutionOutlined',
    tone: 'brand',
    sub: `${data.rows('opportunity').length} 个商机`,
  },
  {
    label: '待我审批',
    value: String(pendingTodos.value.length),
    trend: -8.4,
    icon: 'AuditOutlined',
    tone: 'warning',
    sub: '跨域聚合',
  },
  {
    label: '逾期应收',
    value: '¥ 486.2 万',
    trend: 3.1,
    icon: 'ExclamationCircleOutlined',
    tone: 'danger',
    sub: `涉及 ${overdueAr.value.length} 个客户`,
  },
])

const quickAll = [
  { label: '新建商机', icon: 'SolutionOutlined', path: '/crm/opportunity', action: '新建商机', pageKey: 'opportunity' },
  { label: '发起审批', icon: 'AuditOutlined', path: '/oa/approval', action: '发起审批', pageKey: 'approval' },
  { label: '录入凭证', icon: 'FormOutlined', path: '/finance/voucher/new' },
  { label: '客户 360', icon: 'UserOutlined', path: '/crm/account/360' },
]

/** 快捷入口按权限过滤：没有该应用域的角色不应看到点不进去的按钮 */
const quick = computed(() => {
  return quickAll.filter((q) => {
    const app = appOfPath(q.path)
    return !app || user.hasApp(app)
  })
})

/** 能直接开表单的快捷入口直接开表单，其余跳转到对应页面 */
function onQuick(q: (typeof quickAll)[number]) {
  if (q.action) {
    run(q.action, { pageKey: q.pageKey })
    return
  }
  router.push(q.path)
}

/** 今日日期 */
const todayText = computed(() => {
  const d = new Date()
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · 星期${week}`
})

/**
 * 时间范围：把「近 12 个月 / 近 6 个月 / 本季度」换算成要展示的月份数。
 * 口径统一为「序列末尾往前推 N 个月」——本季度即最近一个季度的 3 个月。
 */
const RANGE_MONTHS: Record<string, number> = { '近 12 个月': 12, '近 6 个月': 6, 本季度: 3 }

/** 当前区间内的月度数据（图表与区间合计都取这里，保证口径一致） */
const rangeMonths = computed(() => {
  const n = RANGE_MONTHS[range.value] ?? 12
  return crmOverview.monthly.slice(-n)
})

/** 区间实际合计（万元） */
const rangeActual = computed(() =>
  rangeMonths.value.reduce((s, m) => s + Number(m.actual || 0), 0),
)

const trendOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { data: ['目标', '实际'], right: 0, top: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 12, color: '#4E5969' } },
  xAxis: {
    type: 'category',
    data: rangeMonths.value.map((m) => m.m),
    axisLine: { lineStyle: { color: '#EDEFF2' } },
    axisTick: { show: false },
    axisLabel: { color: '#86909C', fontSize: 11.5 },
  },
  yAxis: {
    type: 'value',
    name: '万元',
    nameTextStyle: { color: '#86909C', fontSize: 11, padding: [0, 0, 0, 28] },
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: '#F0F1F3' } },
    axisLabel: { color: '#86909C', fontSize: 11.5 },
  },
  series: [
    {
      name: '目标',
      type: 'bar',
      data: rangeMonths.value.map((m) => m.target),
      barWidth: 12,
      itemStyle: { color: '#E8EAED', borderRadius: [3, 3, 0, 0] },
    },
    {
      name: '实际',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      data: rangeMonths.value.map((m) => m.actual),
      lineStyle: { width: 2.4, color: '#165DFF' },
      itemStyle: { color: '#165DFF', borderColor: '#fff', borderWidth: 2 },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(22,93,255,0.18)' },
            { offset: 1, color: 'rgba(22,93,255,0.01)' },
          ],
        },
      },
    },
  ],
}))

const funnelOption = computed(() => ({
  tooltip: { trigger: 'item' },
  series: [
    {
      type: 'funnel',
      left: '6%',
      right: '6%',
      top: 16,
      bottom: 8,
      minSize: '32%',
      gap: 3,
      label: { position: 'inside', color: '#fff', fontSize: 12, formatter: '{b}  {c}' },
      labelLine: { show: false },
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      data: [
        { value: 486, name: '线索', itemStyle: { color: '#94BFFF' } },
        { value: 218, name: '商机', itemStyle: { color: '#3491FA' } },
        { value: 126, name: '方案', itemStyle: { color: '#165DFF' } },
        { value: 58, name: '谈判', itemStyle: { color: '#0E42D2' } },
        { value: 31, name: '成交', itemStyle: { color: '#0B35AC' } },
      ],
    },
  ],
}))

const todoList = computed(() => pendingTodos.value.slice(0, 6))
const noticeList = computed(() => data.rows('notice').slice(0, 5))

/* ---------------- 图表下钻 ---------------- */
/** 经营概览 → 销售目标明细 */
function onTrendClick() {
  drillTo(router, '/crm/target', {}, '已跳转到销售目标明细')
}

/** 销售漏斗 → 转化漏斗分析页 */
function onFunnelClick(p: any) {
  if (!chartName(p)) return
  drillTo(router, '/crm/funnel', {}, '已跳转到转化漏斗分析')
}
</script>

<template>
  <div class="page dash">
    <!-- ============ 欢迎条 ============ -->
    <div class="dash-hero">
      <div class="hero-text">
        <h1>{{ greeting }}，{{ user.user.name }}</h1>
        <p>{{ todayText }} · 今日有 <b>{{ pendingTodos.length }}</b> 条待办、<b>{{ overdueAr.length }}</b> 条预警需处理</p>
      </div>
      <div class="hero-quick">
        <a-button v-for="q in quick" :key="q.label" @click="onQuick(q)">
          <template #icon><AppIcon :name="q.icon" :size="14" /></template>
          {{ q.label }}
        </a-button>
      </div>
    </div>

    <!-- ============ KPI ============ -->
    <div class="kpi-row">
      <div v-for="k in kpis" :key="k.label" class="kpi-card">
        <div class="kpi-top">
          <span class="kpi-label">{{ k.label }}</span>
          <span class="kpi-ico" :class="k.tone"><AppIcon :name="k.icon" :size="15" /></span>
        </div>
        <div class="kpi-value">{{ k.value }}</div>
        <div class="kpi-bottom">
          <span class="kpi-sub">{{ k.sub }}</span>
          <span class="kpi-trend" :class="k.trend >= 0 ? 'up' : 'down'">
            <AppIcon :name="k.trend >= 0 ? 'RiseOutlined' : 'FallOutlined'" :size="11" />
            {{ Math.abs(k.trend) }}%
          </span>
        </div>
      </div>
    </div>

    <!-- ============ 主区 ============ -->
    <div class="dash-grid">
      <div class="card col-span-2">
        <div class="card-hd">
          <h3>经营概览<span class="chart-tip">点击查看销售目标明细</span></h3>
          <a-radio-group v-model:value="range" size="small" button-style="solid">
            <a-radio-button value="近 12 个月">近 12 个月</a-radio-button>
            <a-radio-button value="近 6 个月">近 6 个月</a-radio-button>
            <a-radio-button value="本季度">本季度</a-radio-button>
          </a-radio-group>
        </div>
        <div class="card-bd">
          <div class="chart-note">
            统计区间：<b>{{ range }}</b>（{{ rangeMonths.length }} 个月）· 实际合计 ¥ {{ rangeActual.toFixed(1) }} 万
          </div>
          <BaseChart :option="trendOption" :height="286" clickable @point-click="onTrendClick" />
        </div>
      </div>

      <div class="card" v-if="user.hasApp('oa')">
        <div class="card-hd">
          <h3>我的待办</h3>
          <a class="more-link" @click="router.push('/oa/todo')">全部 {{ pendingTodos.length }} 条</a>
        </div>
        <div class="todo-list">
          <div v-for="t in todoList" :key="t.id" class="todo-item" @click="ui.openDetail('approval', t)">
            <span class="todo-type" :class="t.type.includes('报销') ? 'money' : 'default'">
              {{ t.type }}
            </span>
            <div class="todo-main">
              <div class="todo-title ellipsis">{{ t.title }}</div>
              <div class="todo-meta">{{ t.applicant }} · {{ t.dept }} · {{ t.currentNode }}</div>
            </div>
            <AppIcon name="RightOutlined" :size="11" class="text-3" />
          </div>
        </div>
      </div>

      <div class="card" v-if="user.hasApp('crm')">
        <div class="card-hd">
          <h3>销售漏斗<span class="chart-tip">点击查看转化分析</span></h3>
          <a class="more-link" @click="router.push('/crm/funnel')">查看分析</a>
        </div>
        <div class="card-bd" style="padding-top: 4px">
          <BaseChart :option="funnelOption" :height="252" clickable @point-click="onFunnelClick" />
        </div>
      </div>

      <!-- 无 CRM 权限时改为「我的应用」入口，避免出现点不进去的链接 -->
      <div class="card" v-else>
        <div class="card-hd">
          <h3>我的应用</h3>
          <a class="more-link" @click="router.push('/portal')">应用门户</a>
        </div>
        <div class="my-apps">
          <div v-for="m in user.appMetas" :key="m.code" class="my-app" @click="router.push(m.entry)">
            <span class="my-app-ico" :style="{ background: m.color + '14', color: m.color }">
              <AppIcon :name="m.icon" :size="14" />
            </span>
            <span class="my-app-name">{{ m.name }}</span>
            <AppIcon name="RightOutlined" :size="11" class="text-3" />
          </div>
        </div>
      </div>

      <div class="card" v-if="user.hasApp('oa')">
        <div class="card-hd">
          <h3>公告与动态</h3>
          <a class="more-link" @click="router.push('/oa/notice')">更多</a>
        </div>
        <div class="notice-list">
          <div v-for="n in noticeList" :key="n.id" class="notice-item" @click="ui.openDetail('notice', n)">
            <span class="notice-dot" :class="{ hot: n.top === '是' }" />
            <div class="notice-main">
              <div class="notice-title ellipsis">{{ n.title }}</div>
              <div class="notice-meta">{{ n.publisher }} · {{ n.readCount }} 人已读</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-hd">
          <h3>系统健康度</h3>
          <span class="status-ok"><i /> 全部正常</span>
        </div>
        <div class="card-bd health">
          <div v-for="h in [
            { n: 'API 网关', v: '99.98%', p: 99 },
            { n: '认证服务', v: '99.99%', p: 100 },
            { n: '数据库主库', v: '99.95%', p: 99 },
            { n: '消息队列', v: '99.92%', p: 98 },
            { n: '文件存储', v: '99.99%', p: 100 },
          ]" :key="h.n" class="health-row">
            <span class="h-name">{{ h.n }}</span>
            <a-progress :percent="h.p" :show-info="false" size="small" />
            <span class="h-val num">{{ h.v }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dash {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ---------- 欢迎条 ---------- */
.dash-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}
.hero-text h1 {
  margin: 0 0 5px;
  font-size: 21px;
  font-weight: 600;
  letter-spacing: 0.3px;
}
.hero-text p {
  margin: 0;
  font-size: 13px;
  color: var(--text-3);
}
.hero-text b {
  color: var(--brand-600);
  font-variant-numeric: tabular-nums;
}
.hero-quick {
  display: flex;
  gap: 8px;
}

/* ---------- KPI ---------- */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(226px, 1fr));
  gap: 12px;
}
.kpi-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 15px 16px;
  box-shadow: var(--shadow-card);
  transition: box-shadow var(--dur-base) var(--ease), border-color var(--dur-base) var(--ease);
}
.kpi-card:hover {
  border-color: var(--brand-100);
  box-shadow: 0 2px 12px rgba(22, 93, 255, 0.08);
}
.kpi-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.kpi-label {
  font-size: 12.5px;
  color: var(--text-3);
}
.kpi-ico {
  width: 28px;
  height: 28px;
  border-radius: var(--r-sm);
  display: flex;
  align-items: center;
  justify-content: center;
}
.kpi-ico.brand {
  background: var(--brand-050);
  color: var(--brand-600);
}
.kpi-ico.warning {
  background: var(--warning-bg);
  color: var(--warning);
}
.kpi-ico.danger {
  background: var(--danger-bg);
  color: var(--danger);
}
.kpi-value {
  font-size: 25px;
  font-weight: 600;
  letter-spacing: -0.2px;
  margin: 9px 0 8px;
  font-variant-numeric: tabular-nums;
}
.kpi-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}
.kpi-sub {
  color: var(--text-3);
}
.kpi-trend {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-weight: 500;
}
.kpi-trend.up {
  color: var(--danger);
}
.kpi-trend.down {
  color: var(--success);
}

/* ---------- 栅格 ---------- */
.dash-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.col-span-2 {
  grid-column: span 2;
}
.more-link {
  font-size: 12.5px;
  color: var(--text-3);
  cursor: pointer;
}
.more-link:hover {
  color: var(--brand-600);
}

/* ---------- 待办 ---------- */
.todo-list {
  padding: 6px 0;
}
.todo-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  cursor: pointer;
  transition: background-color var(--dur-base) var(--ease);
}
.todo-item:hover {
  background: var(--surface-hover);
}
.todo-type {
  flex: none;
  font-size: 11px;
  padding: 2px 7px;
  border-radius: var(--r-sm);
  background: var(--neutral-bg);
  color: var(--text-2);
}
.todo-type.money {
  background: var(--warning-bg);
  color: var(--warning);
}
.todo-main {
  min-width: 0;
  flex: 1;
}
.todo-title {
  font-size: 13px;
  color: var(--text-1);
  margin-bottom: 2px;
}
.todo-meta {
  font-size: 11.5px;
  color: var(--text-3);
}

/* ---------- 公告 ---------- */
.notice-list {
  padding: 6px 0;
}
.notice-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 9px 18px;
  cursor: pointer;
  transition: background-color var(--dur-base) var(--ease);
}
.notice-item:hover {
  background: var(--surface-hover);
}
.notice-dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--border-strong);
  margin-top: 7px;
}
.notice-dot.hot {
  background: var(--danger);
  box-shadow: 0 0 0 3px var(--danger-bg);
}
.notice-main {
  min-width: 0;
}
.notice-title {
  font-size: 13px;
  color: var(--text-1);
  margin-bottom: 2px;
}
.notice-meta {
  font-size: 11.5px;
  color: var(--text-3);
}

/* ---------- 我的应用（无 CRM 权限时的占位卡） ---------- */
.my-apps {
  padding: 6px 0;
}
.my-app {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  cursor: pointer;
  transition: background-color var(--dur-base) var(--ease);
}
.my-app:hover {
  background: var(--surface-hover);
}
.my-app-ico {
  width: 26px;
  height: 26px;
  border-radius: var(--r-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.my-app-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-1);
}

/* ---------- 健康度 ---------- */
.status-ok {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--success);
}
.status-ok i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 0 3px var(--success-bg);
}
.health {
  display: flex;
  flex-direction: column;
  gap: 13px;
}
.health-row {
  display: grid;
  grid-template-columns: 92px 1fr 58px;
  align-items: center;
  gap: 10px;
}
.h-name {
  font-size: 12.5px;
  color: var(--text-2);
}
.h-val {
  font-size: 12.5px;
  color: var(--text-1);
  text-align: right;
  font-weight: 500;
}

@media (max-width: 1280px) {
  .dash-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .col-span-2 {
    grid-column: span 2;
  }
}
</style>
