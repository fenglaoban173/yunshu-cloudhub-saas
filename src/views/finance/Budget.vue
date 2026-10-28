<script setup lang="ts">
/**
 * 预算管理
 * ---------------------------------------------------------------------------
 * 页面上每个按钮都是真实行为，没有占位提示：
 *  - 导出：按当前期间导出预算执行明细（预算科目 / 部门 / 期间 / 预算金额 /
 *    已用金额 / 剩余 / 执行率 / 状态）为 CSV，真实下载
 *  - 预算调整：弹出真实的调整申请表单（科目 / 类型 / 金额 / 原因 / 生效期间），
 *    提交后本页新增一条「审批中」的调整记录，并同步刷新对应预算行的
 *    剩余、执行率与状态（削减后超支会自动变红），同时在消息中心留痕
 *  - 图表与进度条全部由表格数据推导，预算调整后立即重算
 */
import { computed, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import BaseChart from '@/components/BaseChart.vue'
import AppIcon from '@/components/AppIcon.vue'
import { budgets } from '@/mock/finance'
import { chartName } from '@/utils/drill'
import { useDataStore } from '@/stores/data'
import { useUserStore } from '@/stores/user'
import { exportCsv, stamp } from '@/utils/export'

/** 本页的预算调整申请 */
interface Adjustment {
  id: string
  time: string
  subject: string
  type: string
  amount: number
  applicant: string
  status: string
  reason: string
  period: string
}

const data = useDataStore()
const user = useUserStore()

const period = ref('2025-Q4')

/* ========================================================== 预算数据（活数据） */
/** mock 只是初始值，后续调整都落在这份本地数据上，图表 / 进度条随之重算 */
const budgetRows = ref(budgets.map((b) => ({ ...b })))

/** 当前期间的预算行（不按部门过滤）：KPI、部门图表都看这一份 */
const periodRows = computed(() =>
  budgetRows.value.filter((b) => b.period === period.value || period.value === '全部'),
)

/** 表格展示的行 = 当前期间 + 部门筛选（部门来自柱状图点击） */
const deptFilter = ref('')
const rows = computed(() =>
  deptFilter.value ? periodRows.value.filter((b) => b.dept === deptFilter.value) : periodRows.value,
)

const totals = computed(() => {
  const t = periodRows.value.reduce((s, b) => s + b.total, 0)
  const u = periodRows.value.reduce((s, b) => s + b.used, 0)
  return { total: t, used: u, rate: t ? +((u / t) * 100).toFixed(1) : 0 }
})

const overBudget = computed(() => periodRows.value.filter((b) => b.status === '超支'))
const warning = computed(() => periodRows.value.filter((b) => b.status === '预警'))

const fmt = (v: number) =>
  v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function nowText() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/* ========================================================== 导出 */
function exportBudget() {
  if (!rows.value.length) {
    message.warning('当前期间没有可导出的预算数据')
    return
  }
  exportCsv(
    `预算执行-${period.value}-${stamp()}`,
    [
      { key: 'subject', title: '预算科目' },
      { key: 'dept', title: '责任部门' },
      { key: 'period', title: '期间' },
      { key: 'total', title: '预算金额(万)' },
      { key: 'used', title: '已用金额(万)' },
      { key: 'remain', title: '剩余(万)' },
      { key: 'rate', title: '执行率(%)' },
      { key: 'status', title: '状态' },
    ],
    rows.value.map((b) => ({ ...b })),
  )
  message.success(`已导出 ${rows.value.length} 条预算数据`)
}

/* ========================================================== 预算调整 */
/** 调整申请记录（最近若干条） */
const adjustments = ref<Adjustment[]>([])
const recentAdjustments = computed(() => adjustments.value.slice(0, 5))

const adjustOpen = ref(false)
const adjustForm = reactive({
  subject: '',
  type: '追加',
  amount: null as number | null,
  reason: '',
  period: '2025-Q4',
  target: '',
})

const subjectOptions = computed(() => {
  const set = new Set<string>()
  // 调整单的科目取整个期间的，不受图表筛选影响
  for (const b of periodRows.value) set.add(b.subject)
  return [...set].map((s) => ({ label: s, value: s }))
})
const targetOptions = computed(() =>
  subjectOptions.value.filter((o) => o.value !== adjustForm.subject),
)

function openAdjust() {
  adjustForm.subject = subjectOptions.value[0]?.value ?? ''
  adjustForm.type = '追加'
  adjustForm.amount = null
  adjustForm.reason = ''
  adjustForm.period = period.value
  adjustForm.target = ''
  adjustOpen.value = true
}

/** 按科目找预算行，优先取同一条（同一期间） */
function findRow(subject: string, preferPeriod?: string) {
  if (preferPeriod) {
    const hit = budgetRows.value.find((b) => b.subject === subject && b.period === preferPeriod)
    if (hit) return hit
  }
  return budgetRows.value.find((b) => b.subject === subject)
}

/** 预算行重算：剩余、执行率与状态（超支 / 预警 / 正常） */
function recalc(b: (typeof budgetRows.value)[number]) {
  // 已用金额是实际发生额，不随预算调整变动；剩余与执行率由预算额推导
  b.remain = +(b.total - b.used).toFixed(2)
  b.rate = b.total ? +((b.used / b.total) * 100).toFixed(1) : 0
  b.status = b.used > b.total ? '超支' : b.used > b.total * 0.85 ? '预警' : '正常'
}

function submitAdjustment() {
  const f = adjustForm
  if (!f.subject) {
    message.warning('请选择预算科目')
    return
  }
  if (!f.amount || f.amount <= 0) {
    message.warning('请填写调整金额')
    return
  }
  if (!f.reason.trim()) {
    message.warning('请填写调整原因')
    return
  }
  const source = findRow(f.subject)
  if (!source) {
    message.warning('预算库中没有该科目，无法发起调整')
    return
  }
  const amount = +f.amount

  if (f.type === '削减' || f.type === '科目变更') {
    if (amount > source.total) {
      message.warning(`调整金额不能超过当前预算总额 ¥ ${fmt(source.total)} 万`)
      return
    }
  }
  if (f.type === '科目变更') {
    if (!f.target) {
      message.warning('请选择转入科目')
      return
    }
    const target = findRow(f.target, source.period)
    if (!target) {
      message.warning('转入科目不存在，请重新选择')
      return
    }
    source.total = +(source.total - amount).toFixed(2)
    recalc(source)
    target.total = +(target.total + amount).toFixed(2)
    recalc(target)
  } else if (f.type === '追加') {
    source.total = +(source.total + amount).toFixed(2)
    recalc(source)
  } else {
    source.total = +(source.total - amount).toFixed(2)
    recalc(source)
  }

  // 调整申请记录：状态固定为「审批中」
  adjustments.value.unshift({
    id: `ADJ${String(adjustments.value.length + 1).padStart(4, '0')}`,
    time: nowText(),
    subject: f.subject,
    type: f.type,
    amount,
    applicant: user.user.name,
    status: '审批中',
    reason: f.reason.trim(),
    period: f.period,
  })

  // 消息中心留痕
  data.addRow('message', {
    title: `预算调整待审批：${f.subject} ${f.type} ${fmt(amount)} 万`,
    type: '业务提醒',
    from: user.user.name,
    priority: '重要',
    read: '未读',
    sendAt: nowText(),
  })

  message.success(`「${f.subject}」预算调整已提交，等待审批`)
  adjustOpen.value = false
}

/* ========================================================== 图表（与表格同源） */
/** 预算行所属期间覆盖的月份下标（7~12 月） */
const PERIOD_MONTHS: Record<string, number[]> = {
  '2025-Q3': [0, 1, 2],
  '2025-Q4': [3, 4, 5],
  '2025年度': [0, 1, 2, 3, 4, 5],
}
const MONTH_LABELS = ['7月', '8月', '9月', '10月', '11月', '12月']

/** 把预算行按所属期间均摊到各月并累计，得到与表格一致的执行曲线 */
function monthlyCum(field: 'total' | 'used') {
  const arr = [0, 0, 0, 0, 0, 0]
  for (const b of periodRows.value) {
    const months = PERIOD_MONTHS[b.period] ?? [0, 1, 2, 3, 4, 5]
    const per = (Number(b[field]) || 0) / months.length
    for (const m of months) arr[m] += per
  }
  let acc = 0
  return arr.map((v) => +(acc += v).toFixed(2))
}

const deptOption = computed(() => {
  const byDept: Record<string, { total: number; used: number }> = {}
  // 图表展示全部部门，它是筛选的入口，不能被筛选结果本身再筛一遍
  for (const b of periodRows.value) {
    byDept[b.dept] ??= { total: 0, used: 0 }
    byDept[b.dept].total += b.total
    byDept[b.dept].used += b.used
  }
  const names = Object.keys(byDept)
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['预算额', '已使用'], right: 0, top: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 12, color: '#4E5969' } },
    grid: { left: 8, right: 20, top: 28, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category', data: names,
      axisLine: { lineStyle: { color: '#EDEFF2' } }, axisTick: { show: false },
      axisLabel: { color: '#86909C', fontSize: 11, interval: 0 },
    },
    yAxis: {
      type: 'value', name: '万元', nameTextStyle: { color: '#86909C', fontSize: 11, padding: [0, 0, 0, 26] },
      axisLine: { show: false }, axisTick: { show: false },
      splitLine: { lineStyle: { color: '#F0F1F3' } }, axisLabel: { color: '#86909C', fontSize: 11 },
    },
    series: [
      { name: '预算额', type: 'bar', barWidth: 16, data: names.map((n) => byDept[n].total), itemStyle: { color: '#E8EAED', borderRadius: [3, 3, 0, 0] } },
      { name: '已使用', type: 'bar', barWidth: 16, data: names.map((n) => byDept[n].used), itemStyle: { color: '#165DFF', borderRadius: [3, 3, 0, 0] } },
    ],
  }
})

/* ========================================================== 图表下钻 */
/**
 * 点部门柱 → 下方的预算明细只留这个部门；再点一次取消。
 * 页内筛选而不是跳走：预算明细本来就在同一页，跳走反而丢了上下文。
 */
function onDeptClick(p: any) {
  const dept = chartName(p)
  if (!dept) return
  deptFilter.value = deptFilter.value === dept ? '' : dept
  message.info(deptFilter.value ? `已筛选「${dept}」的预算明细` : '已取消部门筛选')
}

const trendOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { data: ['累计预算额', '累计已用'], right: 0, top: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 12, color: '#4E5969' } },
  grid: { left: 8, right: 16, top: 28, bottom: 4, containLabel: true },
  xAxis: {
    type: 'category', data: MONTH_LABELS,
    axisLine: { lineStyle: { color: '#EDEFF2' } }, axisTick: { show: false },
    axisLabel: { color: '#86909C', fontSize: 11 },
  },
  yAxis: {
    type: 'value', axisLine: { show: false }, axisTick: { show: false },
    splitLine: { lineStyle: { color: '#F0F1F3' } }, axisLabel: { color: '#86909C', fontSize: 11 },
  },
  series: [
    {
      name: '累计已用', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6,
      data: monthlyCum('used'),
      lineStyle: { width: 2.4, color: '#165DFF' }, itemStyle: { color: '#165DFF' },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: 'rgba(22,93,255,0.18)' }, { offset: 1, color: 'rgba(22,93,255,0.01)' }],
        },
      },
    },
    {
      name: '累计预算额', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6,
      data: monthlyCum('total'),
      lineStyle: { width: 2, color: '#86909C', type: 'dashed' }, itemStyle: { color: '#86909C' },
    },
  ],
}))
</script>

<template>
  <div class="page bg-page">
    <div class="bg-head">
      <div>
        <h1>预算管理</h1>
        <p>预算编制、控制占用与超支预警，与费用报销实时联动</p>
      </div>
      <a-space>
        <a-select v-model:value="period" :options="['2025-Q4', '2025-Q3', '2025年度', '全部'].map(v => ({ label: v, value: v }))" style="width: 118px" />
        <a-button @click="exportBudget">
          <template #icon><AppIcon name="DownloadOutlined" :size="14" /></template>
          导出
        </a-button>
        <a-button type="primary" @click="openAdjust">
          <template #icon><AppIcon name="PlusOutlined" :size="14" /></template>
          预算调整
        </a-button>
      </a-space>
    </div>

    <div class="bg-kpi">
      <div class="bgk">
        <span class="bgk-label">预算总额</span>
        <span class="bgk-val num">¥ {{ fmt(totals.total) }} 万</span>
      </div>
      <div class="bgk">
        <span class="bgk-label">已使用</span>
        <span class="bgk-val num">¥ {{ fmt(totals.used) }} 万</span>
      </div>
      <div class="bgk">
        <span class="bgk-label">执行率</span>
        <span class="bgk-val num" :class="{ warn: totals.rate > 85 }">{{ totals.rate }}%</span>
      </div>
      <div class="bgk">
        <span class="bgk-label">超支项</span>
        <span class="bgk-val num danger">{{ overBudget.length }}</span>
      </div>
      <div class="bgk">
        <span class="bgk-label">预警项</span>
        <span class="bgk-val num warn">{{ warning.length }}</span>
      </div>
    </div>

    <div class="bg-grid">
      <div class="card col2">
        <div class="card-hd">
          <h3>
            预算执行明细
            <a-tag v-if="deptFilter" color="processing" :bordered="false" closable @close="deptFilter = ''">
              部门：{{ deptFilter }}
            </a-tag>
          </h3>
          <span class="cnt">
            {{ rows.length }} 项<template v-if="deptFilter"> / 共 {{ periodRows.length }} 项</template>
          </span>
        </div>
        <div class="card-bd" style="padding: 0">
          <a-table :data-source="rows" :pagination="{ pageSize: 8 }" size="small" row-key="id">
            <a-table-column key="subject" title="预算科目" data-index="subject" width="140" />
            <a-table-column key="dept" title="责任部门" data-index="dept" width="130" />
            <a-table-column key="total" title="预算总额" data-index="total" align="right" width="130">
              <template #default="{ record }">¥ {{ fmt(record.total) }} 万</template>
            </a-table-column>
            <a-table-column key="used" title="已使用" data-index="used" align="right" width="130">
              <template #default="{ record }">¥ {{ fmt(record.used) }} 万</template>
            </a-table-column>
            <a-table-column key="remain" title="剩余" data-index="remain" align="right" width="120">
              <template #default="{ record }">
                <span :class="record.remain < 0 ? 'num danger' : 'num'">¥ {{ fmt(record.remain) }} 万</span>
              </template>
            </a-table-column>
            <a-table-column key="rate" title="执行率" data-index="rate" width="180">
              <template #default="{ record }">
                <a-progress
                  :percent="Math.min(100, record.rate)"
                  size="small"
                  :stroke-color="record.status === '超支' ? '#F53F3F' : record.status === '预警' ? '#FF7D00' : '#165DFF'"
                />
              </template>
            </a-table-column>
            <a-table-column key="status" title="状态" data-index="status" width="88">
              <template #default="{ record }">
                <a-tag :color="record.status === '超支' ? 'error' : record.status === '预警' ? 'warning' : 'success'" :bordered="false">
                  {{ record.status }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column key="owner" title="负责人" data-index="owner" width="92" />
          </a-table>
        </div>
      </div>

      <div class="card">
        <div class="card-hd"><h3>累计执行趋势</h3></div>
        <div class="card-bd">
          <BaseChart :option="trendOption" :height="252" />
          <p class="chart-note">按预算行所属期间均摊后累计，与左侧表格同源</p>
        </div>
      </div>
    </div>

    <div class="bg-grid">
      <div class="card col2">
        <div class="card-hd"><h3>部门预算对比<span class="chart-tip">点击部门筛选明细</span></h3></div>
        <div class="card-bd"><BaseChart :option="deptOption" :height="252" clickable @point-click="onDeptClick" /></div>
      </div>

      <div class="card">
        <div class="card-hd"><h3>超支与预警</h3><span class="cnt">{{ overBudget.length + warning.length }} 项</span></div>
        <div class="card-bd" style="padding: 6px 0">
          <div v-for="b in [...overBudget, ...warning]" :key="b.id" class="al">
            <span class="al-ico" :class="b.status === '超支' ? 'bad' : 'warn'">
              <AppIcon :name="b.status === '超支' ? 'ExclamationCircleOutlined' : 'WarningOutlined'" :size="13" />
            </span>
            <div class="al-main">
              <div class="al-title">{{ b.subject }} · {{ b.dept }}</div>
              <div class="al-meta">已用 ¥ {{ fmt(b.used) }} 万 / 预算 ¥ {{ fmt(b.total) }} 万</div>
            </div>
            <span class="al-rate num" :class="b.status === '超支' ? 'bad' : 'warn'">{{ b.rate }}%</span>
          </div>
          <a-empty v-if="!overBudget.length && !warning.length" description="本期无超支与预警" style="padding: 26px 0" />
        </div>
      </div>
    </div>

    <!-- 调整申请记录 -->
    <div class="card">
      <div class="card-hd">
        <h3>调整申请记录</h3>
        <span class="cnt">共 {{ adjustments.length }} 条</span>
      </div>
      <div class="card-bd" style="padding: 0">
        <a-table :data-source="recentAdjustments" :pagination="false" size="small" row-key="id" :locale="{ emptyText: '暂无预算调整申请' }">
          <a-table-column key="time" title="申请时间" data-index="time" width="170" />
          <a-table-column key="subject" title="预算科目" data-index="subject" width="150" />
          <a-table-column key="type" title="调整类型" data-index="type" width="100" />
          <a-table-column key="amount" title="调整金额" data-index="amount" align="right" width="130">
            <template #default="{ record }">¥ {{ fmt(record.amount) }} 万</template>
          </a-table-column>
          <a-table-column key="applicant" title="申请人" data-index="applicant" width="100" />
          <a-table-column key="period" title="生效期间" data-index="period" width="110" />
          <a-table-column key="reason" title="调整原因" data-index="reason" ellipsis />
          <a-table-column key="status" title="状态" data-index="status" width="100">
            <template #default="{ record }">
              <a-tag color="processing" :bordered="false">{{ record.status }}</a-tag>
            </template>
          </a-table-column>
        </a-table>
      </div>
    </div>

    <!-- 预算调整申请 -->
    <a-modal
      v-model:open="adjustOpen"
      title="发起预算调整"
      ok-text="提交申请"
      cancel-text="取消"
      :mask-closable="false"
      @ok="submitAdjustment"
    >
      <a-form layout="vertical" class="adj-form">
        <a-form-item label="预算科目" required>
          <a-select
            v-model:value="adjustForm.subject"
            :options="subjectOptions"
            placeholder="选择预算科目"
            show-search
          />
        </a-form-item>
        <a-form-item label="调整类型" required>
          <a-radio-group v-model:value="adjustForm.type" button-style="solid">
            <a-radio-button value="追加">追加</a-radio-button>
            <a-radio-button value="削减">削减</a-radio-button>
            <a-radio-button value="科目变更">科目变更</a-radio-button>
          </a-radio-group>
        </a-form-item>
        <a-form-item v-if="adjustForm.type === '科目变更'" label="转入科目" required>
          <a-select
            v-model:value="adjustForm.target"
            :options="targetOptions"
            placeholder="选择转入科目"
            show-search
          />
        </a-form-item>
        <a-form-item label="调整金额（万元）" required>
          <a-input-number
            v-model:value="adjustForm.amount"
            :min="0"
            :precision="2"
            :controls="false"
            placeholder="0.00"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="生效期间" required>
          <a-select
            v-model:value="adjustForm.period"
            :options="['2025-Q4', '2025-Q3', '2025年度', '2026-Q1'].map(v => ({ label: v, value: v }))"
          />
        </a-form-item>
        <a-form-item label="调整原因" required>
          <a-textarea
            v-model:value="adjustForm.reason"
            :rows="3"
            :maxlength="120"
            show-count
            placeholder="说明调整依据，如业务增长、专项投入、核销结余"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.bg-page { display: flex; flex-direction: column; gap: 12px; }
.bg-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.bg-head h1 { margin: 0 0 5px; font-size: 20px; font-weight: 600; }
.bg-head p { margin: 0; font-size: 13px; color: var(--text-3); }
.cnt { font-size: 12px; color: var(--text-3); }

.bg-kpi { display: grid; grid-template-columns: repeat(auto-fit, minmax(168px, 1fr)); gap: 12px; }
.bgk {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg);
  padding: 13px 16px; display: flex; flex-direction: column; gap: 6px; box-shadow: var(--shadow-card);
}
.bgk-label { font-size: 12px; color: var(--text-3); }
.bgk-val { font-size: 21px; font-weight: 600; }
.bgk-val.warn { color: var(--warning); }
.bgk-val.danger { color: var(--danger); }

.bg-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.col2 { grid-column: span 2; }

.al { display: flex; align-items: center; gap: 10px; padding: 9px 18px; }
.al-ico { width: 26px; height: 26px; border-radius: var(--r-sm); display: flex; align-items: center; justify-content: center; flex: none; }
.al-ico.bad { background: var(--danger-bg); color: var(--danger); }
.al-ico.warn { background: var(--warning-bg); color: var(--warning); }
.al-main { flex: 1; min-width: 0; }
.al-title { font-size: 13px; color: var(--text-1); }
.al-meta { font-size: 11.5px; color: var(--text-3); margin-top: 2px; }
.al-rate { font-size: 14px; font-weight: 600; }
.al-rate.bad { color: var(--danger); }
.al-rate.warn { color: var(--warning); }

.chart-note { margin: 6px 0 0; font-size: 11.5px; color: var(--text-4); text-align: center; }
.adj-form { margin-top: 12px; }
.adj-form :deep(.ant-form-item) { margin-bottom: 14px; }
.danger { color: var(--danger); }

@media (max-width: 1280px) { .bg-grid { grid-template-columns: 1fr; } .col2 { grid-column: span 1; } }
</style>
