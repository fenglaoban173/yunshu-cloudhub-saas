<script setup lang="ts">
/**
 * 平台配置 · 工作台（应用域落地页）
 * 进入平台配置系统的默认首页：租户 / 用户 / 角色概览 + 系统运行状态。
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import BaseChart from '@/components/BaseChart.vue'
import AppIcon from '@/components/AppIcon.vue'
import QuickLinks from '@/components/QuickLinks.vue'
import { platformOverview } from '@/mock/platform'
import { chartName, chartSeries, drillTo } from '@/utils/drill'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'

const router = useRouter()
const data = useDataStore()
const ui = useUiStore()

/** 应用域主题色：平台紫 */
const COLOR = '#722ED1'

const quick = [
  { label: '用户管理', icon: 'UserOutlined', path: '/platform/user' },
  { label: '角色权限', icon: 'SafetyOutlined', path: '/platform/role' },
  { label: '租户与套餐', icon: 'GoldOutlined', path: '/platform/tenant' },
  { label: '参数配置', icon: 'ControlOutlined', path: '/platform/config' },
  { label: '操作日志', icon: 'HistoryOutlined', path: '/platform/log' },
]

/** 租户 / 日志 / 消息 —— 读实时仓库 */
const tenantRows = computed(() => data.rows('tenant'))
const logList = computed(() => data.rows('opLog').slice(0, 6))
const msgList = computed(() => data.rows('message').slice(0, 6))
const unreadCount = computed(
  () => data.rows('message').filter((m: any) => m.read === '未读').length,
)
const expiringCount = computed(
  () => data.rows('tenant').filter((t: any) => t.status === '即将到期').length,
)

const kpis = computed(() => [
  {
    label: '接入租户',
    value: String(tenantRows.value.length),
    icon: 'GoldOutlined',
    tone: 'brand',
    sub: `${expiringCount.value} 个即将到期`,
  },
  {
    label: '平台用户',
    value: String(data.rows('sysUser').length),
    icon: 'UserOutlined',
    tone: 'brand',
    sub: '本月新增 26',
  },
  { label: '今日登录', value: '1,284', icon: 'LoginOutlined', tone: 'success', sub: '失败率 1.2%' },
  {
    label: '未读消息',
    value: String(unreadCount.value),
    icon: 'MessageOutlined',
    tone: 'warning',
    sub: '2 条紧急',
  },
])

/** 近 7 日登录趋势 */
const loginOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: {
    data: ['成功', '失败'], right: 0, top: 0, icon: 'roundRect',
    itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 12, color: '#4E5969' },
  },
  xAxis: {
    type: 'category', data: platformOverview.weekly.map((w) => w.d),
    axisLine: { lineStyle: { color: '#EDEFF2' } }, axisTick: { show: false },
    axisLabel: { color: '#86909C', fontSize: 11 },
  },
  yAxis: [
    {
      type: 'value', name: '成功', nameTextStyle: { color: '#86909C', fontSize: 11, padding: [0, 0, 0, 26] },
      axisLine: { show: false }, axisTick: { show: false },
      splitLine: { lineStyle: { color: '#F0F1F3' } }, axisLabel: { color: '#86909C', fontSize: 11 },
    },
    {
      // 失败量级远小于成功，单独用右轴，否则会被压成一条贴底的直线
      type: 'value', name: '失败', nameTextStyle: { color: '#86909C', fontSize: 11, padding: [0, 0, 0, 26] },
      axisLine: { show: false }, axisTick: { show: false },
      splitLine: { show: false }, axisLabel: { color: '#86909C', fontSize: 11 },
    },
  ],
  series: [
    {
      name: '成功', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6,
      data: platformOverview.weekly.map((w) => w.success),
      lineStyle: { width: 2.4, color: COLOR },
      itemStyle: { color: COLOR, borderColor: '#fff', borderWidth: 2 },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(114,46,209,0.18)' },
            { offset: 1, color: 'rgba(114,46,209,0.01)' },
          ],
        },
      },
    },
    {
      name: '失败', type: 'line', yAxisIndex: 1, smooth: true, symbol: 'circle', symbolSize: 6,
      data: platformOverview.weekly.map((w) => w.fail),
      lineStyle: { width: 2, color: '#F53F3F' },
      itemStyle: { color: '#F53F3F' },
    },
  ],
}))

/** 租户套餐分布 */
const planOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}<br/>{c} 个租户 ({d}%)' },
  legend: { bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { fontSize: 12, color: '#4E5969' } },
  series: [{
    type: 'pie', radius: ['48%', '70%'], center: ['50%', '42%'],
    color: ['#722ED1', '#946BFF', '#C9A7FF'],
    itemStyle: { borderColor: '#fff', borderWidth: 2 }, label: { show: false },
    data: platformOverview.plans,
  }],
}))

const failCount = data.rows('loginLog').filter((l: any) => l.result === '失败').length

/* ---------------- 图表下钻 ---------------- */
/** 登录趋势是双轴折线：点到的点是「成功」还是「失败」，看 seriesName */
function onLoginClick(p: any) {
  const result = chartSeries(p)
  if (!result) return
  drillTo(router, '/platform/login-log', { result }, `已跳转到登录日志 · 结果「${result}」`)
}

/** 套餐分布 → 租户管理，并按套餐筛选 */
function onPlanClick(p: any) {
  const plan = chartName(p)
  if (!plan) return
  drillTo(router, '/platform/tenant', { plan }, `已跳转到租户管理 · 套餐「${plan}」`)
}

function planTone(plan: string) {
  if (plan.includes('旗舰')) return 'purple'
  if (plan.includes('专业')) return 'blue'
  return 'default'
}
function tenantTone(status: string) {
  return status === '正常' ? 'success' : status === '即将到期' ? 'warning' : 'error'
}
</script>

<template>
  <div class="page pl-ov">
    <div class="ov-head">
      <div>
        <h1>工作台</h1>
        <p>平台配置 · 租户、用户与系统运行状态</p>
      </div>
      <a-space>
        <a-button @click="router.push('/platform/tenant')">
          <template #icon><AppIcon name="GoldOutlined" :size="14" /></template>
          租户与套餐
        </a-button>
        <a-button type="primary" @click="router.push('/platform/user')">
          <template #icon><AppIcon name="UserOutlined" :size="14" /></template>
          用户管理
        </a-button>
      </a-space>
    </div>

    <QuickLinks :items="quick" :color="COLOR" />

    <div class="kpi4">
      <div v-for="k in kpis" :key="k.label" class="k">
        <span class="k-ico" :class="k.tone"><AppIcon :name="k.icon" :size="15" /></span>
        <div>
          <div class="k-label">{{ k.label }}</div>
          <div class="k-val num">{{ k.value }}</div>
          <div class="k-sub">{{ k.sub }}</div>
        </div>
      </div>
    </div>

    <div class="grid3">
      <div class="card col2">
        <div class="card-hd">
          <h3>近 7 日登录趋势<span class="chart-tip">点击查看登录日志</span></h3>
          <span class="cnt">失败 {{ failCount }} 次</span>
        </div>
        <div class="card-bd"><BaseChart :option="loginOption" :height="262" clickable @point-click="onLoginClick" /></div>
      </div>

      <div class="card">
        <div class="card-hd"><h3>租户套餐分布<span class="chart-tip">点击查看该套餐租户</span></h3></div>
        <div class="card-bd"><BaseChart :option="planOption" :height="262" clickable @point-click="onPlanClick" /></div>
      </div>
    </div>

    <div class="card">
      <div class="card-hd">
        <h3>租户概览</h3>
        <a class="more" @click="router.push('/platform/tenant')">全部租户</a>
      </div>
      <div class="card-bd" style="padding: 0">
        <a-table :data-source="tenantRows" :pagination="false" size="small" row-key="id">
          <a-table-column key="name" title="租户" data-index="name">
            <template #default="{ record }">
              <a class="cell-link" @click="ui.openDetail('tenant', record)">{{ record.name }}</a>
            </template>
          </a-table-column>
          <a-table-column key="plan" title="套餐" data-index="plan" width="170">
            <template #default="{ record }">
              <a-tag :color="planTone(record.plan)" :bordered="false">{{ record.plan }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column key="users" title="用户 / 上限" width="130" align="right">
            <template #default="{ record }">
              <span class="num">{{ record.users }} / {{ record.maxUsers }}</span>
            </template>
          </a-table-column>
          <a-table-column key="storage" title="存储" data-index="storage" width="100" align="right" />
          <a-table-column key="domains" title="应用域" data-index="domains" width="90" align="right" />
          <a-table-column key="expireAt" title="到期日" data-index="expireAt" width="120" />
          <a-table-column key="status" title="状态" data-index="status" width="100">
            <template #default="{ record }">
              <a-tag :color="tenantTone(record.status)" :bordered="false">{{ record.status }}</a-tag>
            </template>
          </a-table-column>
        </a-table>
      </div>
    </div>

    <div class="grid3">
      <div class="card col2">
        <div class="card-hd">
          <h3>最近操作日志</h3>
          <a class="more" @click="router.push('/platform/log')">全部日志</a>
        </div>
        <div class="card-bd" style="padding: 0">
          <a-table :data-source="logList" :pagination="false" size="small" row-key="id">
            <a-table-column key="operator" title="操作人" data-index="operator" width="100" />
            <a-table-column key="module" title="模块" data-index="module" width="120" />
            <a-table-column key="action" title="动作" data-index="action" width="80" />
            <a-table-column key="target" title="对象" data-index="target" />
            <a-table-column key="time" title="时间" data-index="time" width="150" />
            <a-table-column key="result" title="结果" data-index="result" width="80">
              <template #default="{ record }">
                <a-tag :color="record.result === '成功' ? 'success' : 'error'" :bordered="false">{{ record.result }}</a-tag>
              </template>
            </a-table-column>
          </a-table>
        </div>
      </div>

      <div class="card">
        <div class="card-hd">
          <h3>系统消息</h3>
          <a class="more" @click="router.push('/platform/message')">消息中心</a>
        </div>
        <div class="card-bd" style="padding: 6px 0">
          <div v-for="m in msgList" :key="m.id" class="row" @click="ui.openDetail('message', m)">
            <span class="dot" :class="{ unread: m.read === '未读' }" />
            <div class="row-main">
              <div class="row-t ellipsis">{{ m.title }}</div>
              <div class="row-s">{{ m.from }} · {{ m.type }}</div>
            </div>
            <a-tag v-if="m.priority === '紧急' || m.priority === '重要'" color="error" :bordered="false">{{ m.priority }}</a-tag>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-hd">
        <h3>平台服务健康度</h3>
        <span class="cnt">全部正常</span>
      </div>
      <div class="card-bd health">
        <div v-for="h in platformOverview.health" :key="h.name" class="health-row">
          <span class="h-name">{{ h.name }}</span>
          <a-progress :percent="h.p" :show-info="false" size="small" :stroke-color="COLOR" />
          <span class="h-val num">{{ h.v }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pl-ov { display: flex; flex-direction: column; gap: 12px; }
.ov-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.ov-head h1 { margin: 0 0 5px; font-size: 20px; font-weight: 600; }
.ov-head p { margin: 0; font-size: 13px; color: var(--text-3); }
.more { font-size: 12.5px; color: var(--text-3); cursor: pointer; }
.more:hover { color: var(--brand-600); }
.cnt { font-size: 12px; color: var(--text-3); }
.cell-link { color: var(--brand-600); cursor: pointer; }
.cell-link:hover { text-decoration: underline; }

.kpi4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(206px, 1fr)); gap: 12px; }
.k {
  display: flex; align-items: flex-start; gap: 11px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: 13px 15px; box-shadow: var(--shadow-card);
}
.k-ico { width: 34px; height: 34px; border-radius: var(--r-md); display: flex; align-items: center; justify-content: center; flex: none; }
.k-ico.brand { background: #722ed114; color: #722ed1; }
.k-ico.success { background: var(--success-bg); color: var(--success); }
.k-ico.warning { background: var(--warning-bg); color: var(--warning); }
.k-label { font-size: 12px; color: var(--text-3); }
.k-val { font-size: 21px; font-weight: 600; line-height: 1.25; margin: 2px 0 3px; font-variant-numeric: tabular-nums; }
.k-sub { font-size: 11.5px; color: var(--text-3); }

.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.col2 { grid-column: span 2; }

.row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 20px; cursor: pointer;
  transition: background-color var(--dur-base) var(--ease);
}
.row:hover { background: var(--surface-hover); }
.row-main { min-width: 0; flex: 1; }
.row-t { font-size: 13px; color: var(--text-1); margin-bottom: 3px; }
.row-s { font-size: 11.5px; color: var(--text-3); }

.dot { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--border-strong); }
.dot.unread { background: var(--danger); box-shadow: 0 0 0 3px var(--danger-bg); }

.health { display: flex; flex-direction: column; gap: 13px; }
.health-row { display: grid; grid-template-columns: 92px 1fr 58px; align-items: center; gap: 10px; }
.h-name { font-size: 12.5px; color: var(--text-2); }
.h-val { font-size: 12.5px; text-align: right; color: var(--text-1); font-weight: 500; }

@media (max-width: 1280px) {
  .grid3 { grid-template-columns: repeat(2, 1fr); }
  .col2 { grid-column: span 2; }
}
</style>
