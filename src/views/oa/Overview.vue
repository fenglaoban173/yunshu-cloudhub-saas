<script setup lang="ts">
/**
 * OA 协同办公 · 工作台（应用域落地页）
 * 进入 OA 系统的默认首页：概览指标 + 图表 + 待办与日程入口。
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import BaseChart from '@/components/BaseChart.vue'
import AppIcon from '@/components/AppIcon.vue'
import QuickLinks from '@/components/QuickLinks.vue'
import { oaOverview } from '@/mock/oa'
import { chartName, chartSeries, drillTo } from '@/utils/drill'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'

const router = useRouter()
const data = useDataStore()
const ui = useUiStore()

/** 应用域主题色：OA 绿 */
const COLOR = '#00B42A'

const quick = [
  { label: '发起审批', icon: 'AuditOutlined', path: '/oa/approval' },
  { label: '请假申请', icon: 'HighlightOutlined', path: '/oa/leave' },
  { label: '费用报销', icon: 'PayCircleOutlined', path: '/oa/expense' },
  { label: '通知公告', icon: 'NotificationOutlined', path: '/oa/notice' },
  { label: '组织架构', icon: 'ClusterOutlined', path: '/oa/org' },
]

/** 等待时长：优先取已有字段，否则按单号派生一个稳定的值 */
function waitOf(row: any) {
  if (row?.waitHours !== undefined) return row.waitHours
  const n = Number(String(row?.id ?? '0').replace(/\D/g, '')) || 0
  return (n * 13) % 96 + 1
}

/** 待我审批：读实时仓库，审批后这里立刻少一条 */
const pendingRows = computed(() =>
  data.rows('approval').filter((a: any) => a.status === '审批中'),
)
const pendingList = computed(() =>
  [...pendingRows.value]
    .sort((a: any, b: any) => waitOf(b) - waitOf(a))
    .slice(0, 6)
    .map((a: any) => ({
      ...a,
      waitHours: waitOf(a),
      from: `${a.applicant} · ${a.dept}`,
    })),
)
const meetingList = computed(() => data.rows('meeting').slice(0, 5))
const noticeList = computed(() => data.rows('notice').slice(0, 5))
const flowList = computed(() => data.rows('flow').slice(0, 5))
const enabledFlows = computed(() => data.rows('flow').filter((f: any) => f.status === '启用').length)
const overdueCount = computed(() => pendingList.value.filter((t: any) => t.waitHours >= 72).length)

const kpis = computed(() => [
  {
    label: '待我审批',
    value: String(pendingRows.value.length),
    icon: 'AuditOutlined',
    tone: 'warning',
    sub: `${overdueCount.value} 条即将超时`,
  },
  {
    label: '我本周已处理',
    value: String(data.rows('approval').filter((a: any) => a.status === '已通过').length),
    icon: 'CheckCircleOutlined',
    tone: 'success',
    sub: '平均 6.4 h 完成',
  },
  {
    label: '在办流程',
    value: String(pendingRows.value.length),
    icon: 'ApartmentOutlined',
    tone: 'brand',
    sub: `启用模板 ${enabledFlows.value} 个`,
  },
  { label: '今日在岗', value: '428', icon: 'TeamOutlined', tone: 'brand', sub: '在岗率 88.1%' },
])

/** 近 7 日全公司审批量（堆叠柱） */
const weeklyOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: {
    data: ['已通过', '审批中', '已驳回'], right: 0, top: 0, icon: 'roundRect',
    itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 12, color: '#4E5969' },
  },
  xAxis: {
    type: 'category', data: oaOverview.weekly.map((w) => w.d),
    axisLine: { lineStyle: { color: '#EDEFF2' } }, axisTick: { show: false },
    axisLabel: { color: '#86909C', fontSize: 11 },
  },
  yAxis: {
    type: 'value', name: '单', nameTextStyle: { color: '#86909C', fontSize: 11, padding: [0, 0, 0, 26] },
    axisLine: { show: false }, axisTick: { show: false },
    splitLine: { lineStyle: { color: '#F0F1F3' } }, axisLabel: { color: '#86909C', fontSize: 11 },
  },
  series: [
    { name: '已通过', type: 'bar', stack: 'oa', barWidth: 14, data: oaOverview.weekly.map((w) => w.passed), itemStyle: { color: '#00B42A' } },
    { name: '审批中', type: 'bar', stack: 'oa', barWidth: 14, data: oaOverview.weekly.map((w) => w.pending), itemStyle: { color: '#FF7D00' } },
    { name: '已驳回', type: 'bar', stack: 'oa', barWidth: 14, data: oaOverview.weekly.map((w) => w.rejected), itemStyle: { color: '#F53F3F', borderRadius: [3, 3, 0, 0] } },
  ],
}))

/** 审批类型分布 */
const typeOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}<br/>{c} 条 ({d}%)' },
  legend: { bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { fontSize: 12, color: '#4E5969' } },
  series: [{
    type: 'pie', radius: ['48%', '70%'], center: ['50%', '42%'],
    color: ['#00B42A', '#23C343', '#4CD28C', '#7AE2A8', '#A9EFC5', '#D4F8DF', '#14C9C9'],
    itemStyle: { borderColor: '#fff', borderWidth: 2 }, label: { show: false },
    data: oaOverview.types,
  }],
}))

const deptTotal = oaOverview.deptSize.reduce((s, d) => s + d.value, 0)

/* ---------------- 图表下钻 ---------------- */
/**
 * 近 7 日审批量是堆叠柱：点到的具体是「已通过 / 审批中 / 已驳回」哪一段，
 * 所以要看 seriesName（x 轴上是日期，筛状态没意义）。
 */
function onWeeklyClick(p: any) {
  const status = chartSeries(p)
  if (!status) return
  drillTo(router, '/oa/approval', { status }, `已跳转到审批中心 · 状态「${status}」`)
}

/** 审批类型分布：点扇区 → 只看该类型的审批单 */
function onTypeClick(p: any) {
  const type = chartName(p)
  if (!type) return
  drillTo(router, '/oa/approval', { type }, `已跳转到审批中心 · 类型「${type}」`)
}

function urgencyTone(u: string) {
  return u === '特急' ? 'error' : u === '加急' ? 'warning' : 'default'
}
</script>

<template>
  <div class="page oa-ov">
    <div class="ov-head">
      <div>
        <h1>工作台</h1>
        <p>OA 协同办公 · 审批、组织与日程全景</p>
      </div>
      <a-space>
        <a-button @click="router.push('/oa/todo')">
          <template #icon><AppIcon name="CarryOutOutlined" :size="14" /></template>
          我的待办
        </a-button>
        <a-button type="primary" @click="router.push('/oa/approval')">
          <template #icon><AppIcon name="AuditOutlined" :size="14" /></template>
          发起审批
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
          <h3>近 7 日审批量<span class="chart-tip">点击状态查看审批单</span></h3>
          <span class="cnt">全公司</span>
        </div>
        <div class="card-bd"><BaseChart :option="weeklyOption" :height="262" clickable @point-click="onWeeklyClick" /></div>
      </div>

      <div class="card">
        <div class="card-hd"><h3>审批类型分布<span class="chart-tip">点击类型查看审批单</span></h3></div>
        <div class="card-bd"><BaseChart :option="typeOption" :height="262" clickable @point-click="onTypeClick" /></div>
      </div>
    </div>

    <div class="grid3">
      <div class="card">
        <div class="card-hd">
          <h3>待我审批</h3>
          <a class="more" @click="router.push('/oa/todo')">全部 {{ pendingRows.length }} 条</a>
        </div>
        <div class="card-bd" style="padding: 6px 0">
          <div v-for="t in pendingList" :key="t.id" class="row" @click="ui.openDetail('approval', t)">
            <div class="row-main">
              <div class="row-t ellipsis">
                {{ t.title }}
                <a-tag v-if="t.urgency !== '普通'" :color="urgencyTone(t.urgency)" :bordered="false" style="margin-left: 6px">
                  {{ t.urgency }}
                </a-tag>
              </div>
              <div class="row-s">{{ t.from }} · 等待 {{ t.waitHours }} h</div>
            </div>
            <div class="row-right">
              <div class="row-amt num">¥ {{ t.amount.toFixed(2) }}</div>
              <div class="row-s">{{ t.currentNode }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-hd">
          <h3>近期会议</h3>
          <a class="more" @click="router.push('/oa/meeting')">会议室</a>
        </div>
        <div class="card-bd" style="padding: 6px 0">
          <div v-for="m in meetingList" :key="m.id" class="row" @click="router.push('/oa/meeting')">
            <div class="row-main">
              <div class="row-t ellipsis">{{ m.subject }}</div>
              <div class="row-s">{{ m.room }} · {{ m.organizer }}</div>
            </div>
            <div class="row-right">
              <div class="row-amt num">{{ m.time }}</div>
              <div class="row-s">{{ m.attendees }} 人 · {{ m.duration }} h</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-hd">
          <h3>最新公告</h3>
          <a class="more" @click="router.push('/oa/notice')">更多</a>
        </div>
        <div class="card-bd" style="padding: 6px 0">
          <div v-for="n in noticeList" :key="n.id" class="row" @click="router.push('/oa/notice')">
            <span class="dot" :class="{ hot: n.top === '是' }" />
            <div class="row-main">
              <div class="row-t ellipsis">{{ n.title }}</div>
              <div class="row-s">{{ n.publisher }} · {{ n.readCount }} 人已读</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid3">
      <div class="card col2">
        <div class="card-hd">
          <h3>常用流程</h3>
          <a class="more" @click="router.push('/oa/flow')">流程模板</a>
        </div>
        <div class="card-bd" style="padding: 0">
          <a-table :data-source="flowList" :pagination="false" size="small" row-key="id">
            <a-table-column key="name" title="流程名称" data-index="name" />
            <a-table-column key="type" title="类型" data-index="type" width="110" />
            <a-table-column key="version" title="版本" data-index="version" width="80" />
            <a-table-column key="nodeCount" title="节点" data-index="nodeCount" align="right" width="70" />
            <a-table-column key="instanceCount" title="运行实例" data-index="instanceCount" align="right" width="90" />
            <a-table-column key="status" title="状态" data-index="status" width="80">
              <template #default="{ record }">
                <a-tag :color="record.status === '启用' ? 'success' : 'default'" :bordered="false">{{ record.status }}</a-tag>
              </template>
            </a-table-column>
          </a-table>
        </div>
      </div>

      <div class="card">
        <div class="card-hd">
          <h3>部门人员分布</h3>
          <a class="more" @click="router.push('/oa/org')">组织架构</a>
        </div>
        <div class="card-bd dept">
          <div v-for="d in oaOverview.deptSize" :key="d.name" class="dept-row">
            <span class="dept-name">{{ d.name }}</span>
            <a-progress
              :percent="Math.round((d.value / deptTotal) * 100)"
              :show-info="false"
              size="small"
              :stroke-color="COLOR"
            />
            <span class="dept-val num">{{ d.value }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.oa-ov { display: flex; flex-direction: column; gap: 12px; }
.ov-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.ov-head h1 { margin: 0 0 5px; font-size: 20px; font-weight: 600; }
.ov-head p { margin: 0; font-size: 13px; color: var(--text-3); }
.more { font-size: 12.5px; color: var(--text-3); cursor: pointer; }
.more:hover { color: var(--brand-600); }
.cnt { font-size: 12px; color: var(--text-3); }

.kpi4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(206px, 1fr)); gap: 12px; }
.k {
  display: flex; align-items: flex-start; gap: 11px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: 13px 15px; box-shadow: var(--shadow-card);
}
.k-ico { width: 34px; height: 34px; border-radius: var(--r-md); display: flex; align-items: center; justify-content: center; flex: none; }
.k-ico.brand { background: #00b42a14; color: #00b42a; }
.k-ico.success { background: var(--success-bg); color: var(--success); }
.k-ico.warning { background: var(--warning-bg); color: var(--warning); }
.k-ico.danger { background: var(--danger-bg); color: var(--danger); }
.k-label { font-size: 12px; color: var(--text-3); }
.k-val { font-size: 21px; font-weight: 600; line-height: 1.25; margin: 2px 0 3px; font-variant-numeric: tabular-nums; }
.k-sub { font-size: 11.5px; color: var(--text-3); }

.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.col2 { grid-column: span 2; }

.row {
  display: flex; align-items: center; justify-content: space-between; gap: 14px;
  padding: 10px 20px; cursor: pointer;
  transition: background-color var(--dur-base) var(--ease);
}
.row:hover { background: var(--surface-hover); }
.row-main { min-width: 0; flex: 1; }
.row-t { font-size: 13px; color: var(--text-1); margin-bottom: 3px; }
.row-s { font-size: 11.5px; color: var(--text-3); }
.row-right { text-align: right; flex: none; }
.row-amt { font-size: 13.5px; font-weight: 600; }

.dot { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--border-strong); }
.dot.hot { background: var(--danger); box-shadow: 0 0 0 3px var(--danger-bg); }

.dept { display: flex; flex-direction: column; gap: 11px; }
.dept-row { display: grid; grid-template-columns: 84px 1fr 40px; align-items: center; gap: 10px; }
.dept-name { font-size: 12.5px; color: var(--text-2); }
.dept-val { font-size: 12.5px; text-align: right; color: var(--text-1); font-weight: 500; }

@media (max-width: 1280px) {
  .grid3 { grid-template-columns: repeat(2, 1fr); }
  .col2 { grid-column: span 2; }
}
</style>
