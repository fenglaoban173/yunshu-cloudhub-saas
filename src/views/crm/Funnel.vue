<script setup lang="ts">
/**
 * CRM 销售漏斗
 * ---------------------------------------------------------------------------
 * 漏斗各阶段、来源构成、代表业绩全部由 `stores/data.ts` 中 opportunity 页签的
 * 实时数据聚合而来——期间切换、阶段 / 来源 / 负责人筛选都会真实改变图表与明细。
 *
 * 交互：
 *   - 期间切换：按预计成交日期归入的季度 / 半年过滤商机
 *   - 阶段、来源、代表榜均可点选，直接筛选下方「商机明细」
 *   - 商机明细行点开详情，行内可直接推进阶段 / 报价 / 转合同
 *   - 导出明细：真实下载当前筛选结果的 CSV
 */
import { computed, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useRouter } from 'vue-router'
import BaseChart from '@/components/BaseChart.vue'
import AppIcon from '@/components/AppIcon.vue'
import { stagePool } from '@/mock/crm'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import { useAction } from '@/composables/useAction'
import { exportCsv, stamp } from '@/utils/export'

const router = useRouter()
const data = useDataStore()
const ui = useUiStore()
const { run } = useAction()

/* ---------------- 数据源 ---------------- */
const allRows = computed<any[]>(() => data.rows('opportunity'))

/** 阶段定义（含标准赢率），与商机看板口径一致 */
const stages = stagePool

/** 阶段赢率：优先取阶段配置，兼容历史数据 */
function rateOf(r: any): number {
  const s = stages.find((x) => x.name === r.stage)
  return s ? s.rate : Number(r.probability ?? 0)
}

/* ---------------- 期间切换 ---------------- */
/** 期间选项：从商机的预计成交日期里提取实际存在的季度与半年 */
const periodOptions = computed(() => {
  const quarters = new Set<string>()
  const halves = new Set<string>()
  for (const r of allRows.value) {
    const d = String(r.expectedClose ?? '').slice(0, 10)
    if (!/^\d{4}-\d{2}/.test(d)) continue
    const y = d.slice(0, 4)
    const m = Number(d.slice(5, 7))
    quarters.add(`${y} Q${Math.ceil(m / 3)}`)
    halves.add(`${y} H${m <= 6 ? 1 : 2}`)
  }
  return [
    { label: '全部期间', value: 'ALL' },
    ...[...quarters].sort().map((q) => ({ label: q, value: q })),
    ...[...halves].sort().map((h) => ({ label: h, value: h })),
  ]
})

const period = ref<string>('ALL')

/** 期间过滤：预计成交日期落在所选季度 / 半年的商机 */
function inPeriod(r: any): boolean {
  if (period.value === 'ALL') return true
  const d = String(r.expectedClose ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}/.test(d)) return false
  const y = d.slice(0, 4)
  const m = Number(d.slice(5, 7))
  return period.value === `${y} Q${Math.ceil(m / 3)}` || period.value === `${y} H${m <= 6 ? 1 : 2}`
}

/** 当前期间内的商机 */
const periodRows = computed<any[]>(() => allRows.value.filter(inPeriod))

/* ---------------- 聚合指标 ---------------- */
const pipeline = computed(() => periodRows.value.reduce((a, r) => a + Number(r.amount || 0), 0))
const weighted = computed(() =>
  periodRows.value.reduce((a, r) => a + (Number(r.amount || 0) * rateOf(r)) / 100, 0),
)
const avgRate = computed(() => (pipeline.value ? (weighted.value / pipeline.value) * 100 : 0))

/** 平均成交周期：创建日至预计成交日的平均天数 */
function avgCycle(rows: any[]): string {
  const ds = rows
    .map((r) => {
      const c = String(r.createdAt ?? '').slice(0, 10)
      const e = String(r.expectedClose ?? '').slice(0, 10)
      if (!c || !e) return null
      const diff = (new Date(e).getTime() - new Date(c).getTime()) / 86400000
      return Number.isFinite(diff) ? diff : null
    })
    .filter((v): v is number => v !== null)
  if (!ds.length) return '—'
  return `${(ds.reduce((a, b) => a + b, 0) / ds.length).toFixed(0)} 天`
}

/** 阶段聚合：数量 / 金额 / 占比 / 阶段转化率 / 平均成交周期 */
const stageStats = computed(() => {
  const total = periodRows.value.length || 1
  return stages.map((s, i) => {
    const rows = periodRows.value.filter((r) => r.stage === s.name)
    const amount = rows.reduce((a, r) => a + Number(r.amount || 0), 0)
    const prev = i > 0 ? periodRows.value.filter((r) => r.stage === stages[i - 1].name).length : 0
    return {
      name: s.name,
      rate: s.rate,
      count: rows.length,
      amount,
      share: (rows.length / total) * 100,
      conv: i === 0 || !prev ? '—' : `${((rows.length / prev) * 100).toFixed(1)}%`,
      cycle: avgCycle(rows),
    }
  })
})

/** 来源构成 */
const sourceStats = computed(() => {
  const map = new Map<string, number>()
  for (const r of periodRows.value) {
    const s = r.source || '未知来源'
    map.set(s, (map.get(s) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
})

/** 销售代表业绩 */
const repStats = computed(() => {
  const map = new Map<string, { count: number; amount: number; rate: number }>()
  for (const r of periodRows.value) {
    const o = r.owner || '未分配'
    const cur = map.get(o) ?? { count: 0, amount: 0, rate: 0 }
    cur.count += 1
    cur.amount += Number(r.amount || 0)
    cur.rate += rateOf(r)
    map.set(o, cur)
  }
  return [...map.entries()]
    .map(([name, v]) => ({
      name,
      count: v.count,
      amount: v.amount,
      rate: v.count ? v.rate / v.count : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
})

/* ---------------- 联动筛选 ---------------- */
const focusStage = ref<string>('')
const focusSource = ref<string>('')
const focusOwner = ref<string>('')

const hasFocus = computed(() => !!(focusStage.value || focusSource.value || focusOwner.value))

/** 叠加筛选后的商机明细 */
const filteredRows = computed(() =>
  periodRows.value.filter(
    (r) =>
      (!focusStage.value || r.stage === focusStage.value) &&
      (!focusSource.value || (r.source || '未知来源') === focusSource.value) &&
      (!focusOwner.value || r.owner === focusOwner.value),
  ),
)

function toggleStage(name: string) {
  focusStage.value = focusStage.value === name ? '' : name
}
function toggleSource(name: string) {
  focusSource.value = focusSource.value === name ? '' : name
}
function toggleOwner(name: string) {
  focusOwner.value = focusOwner.value === name ? '' : name
}

/* ---------------- 图表点击 → 联动筛选 ---------------- */
/** 点漏斗阶段：筛选该阶段的商机明细 */
function onFunnelClick(p: any) {
  if (!p?.name) return
  toggleStage(p.name)
}
/** 点来源扇区：筛选该来源的商机明细 */
function onSourceClick(p: any) {
  if (!p?.name) return
  toggleSource(p.name)
}
/** 点负责人柱：筛选该负责人的商机明细 */
function onRepClick(p: any) {
  if (!p?.name) return
  toggleOwner(p.name)
}
function clearFocus() {
  focusStage.value = ''
  focusSource.value = ''
  focusOwner.value = ''
}

/* ---------------- 图表配置 ---------------- */
const funnelColors = ['#94BFFF', '#6AA1FF', '#3491FA', '#165DFF', '#0B35AC']

const funnelOption = computed(() => ({
  tooltip: {
    trigger: 'item',
    formatter: (p: any) => {
      const st = stageStats.value.find((s) => s.name === p.name)
      return `${p.name}<br/>商机 ${st?.count ?? 0} 个<br/>金额 ¥ ${(st?.amount ?? 0).toFixed(1)} 万`
    },
  },
  series: [
    {
      type: 'funnel',
      left: '4%',
      right: '4%',
      top: 10,
      bottom: 10,
      minSize: '28%',
      gap: 3,
      // 按阶段推进顺序排列（不按数量倒序），漏斗宽度才反映真实的阶段分布
      sort: 'none',
      label: { position: 'inside', color: '#fff', fontSize: 12, formatter: '{b}  {c}' },
      labelLine: { show: false },
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      data: stageStats.value.map((s, i) => ({
        value: s.count,
        name: s.name,
        itemStyle: { color: funnelColors[i] },
      })),
    },
  ],
}))

const sourceOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}<br/>{c} 条 ({d}%)' },
  legend: { bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { fontSize: 12, color: '#4E5969' } },
  series: [
    {
      type: 'pie',
      radius: ['46%', '68%'],
      center: ['50%', '42%'],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: sourceStats.value.map((s) => ({ name: s.name, value: s.value })),
    },
  ],
}))

const repOption = computed(() => ({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  grid: { left: 8, right: 20, top: 16, bottom: 4, containLabel: true },
  xAxis: {
    type: 'value',
    name: '万元',
    nameTextStyle: { color: '#86909C', fontSize: 11 },
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: '#F0F1F3' } },
    axisLabel: { color: '#86909C', fontSize: 11 },
  },
  yAxis: {
    type: 'category',
    data: repStats.value.slice(0, 8).map((r) => r.name),
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#4E5969', fontSize: 12 },
  },
  series: [
    {
      type: 'bar',
      barWidth: 14,
      itemStyle: { color: '#165DFF', borderRadius: [0, 4, 4, 0] },
      data: repStats.value.slice(0, 8).map((r) => +r.amount.toFixed(1)),
    },
  ],
}))

/* ---------------- 明细表 ---------------- */
const detailColumns = [
  { key: 'id', title: '商机编号', dataIndex: 'id', width: 116 },
  { key: 'name', title: '商机名称', dataIndex: 'name', width: 260 },
  { key: 'customer', title: '客户', dataIndex: 'customer', width: 200 },
  { key: 'stage', title: '阶段', dataIndex: 'stage', width: 106 },
  { key: 'amount', title: '金额(万)', dataIndex: 'amount', width: 120, align: 'right' },
  { key: 'probability', title: '赢率', dataIndex: 'probability', width: 86, align: 'right' },
  { key: 'owner', title: '负责人', dataIndex: 'owner', width: 96 },
  { key: 'expectedClose', title: '预计成交', dataIndex: 'expectedClose', width: 116 },
  { key: '__action', title: '操作', width: 200, align: 'left' },
]

function openDetail(row: any) {
  ui.openDetail('opportunity', row)
}

/**
 * 转化单据（报价单 / 合同）时用的源记录副本：去掉「创建时间」。
 * 商机的「创建时间」是日期粒度（2025-07-17），而报价单的「创建时间」是
 * 日期时间粒度（YYYY-MM-DD HH:mm），原样带过去会显示 Invalid Date；
 * 去掉后由公共表单按当前时间自动补齐。
 */
function convertSource(row: any): any {
  const r = { ...row }
  delete r.createdAt
  return r
}

function onRowAction(name: string, row: any) {
  // 推进阶段 / 详情必须传原始行（阶段推进要落回 store），转化类动作传净化后的副本
  const r = name === '推进阶段' || name === '详情' ? row : convertSource(row)
  run(name, { pageKey: 'opportunity', row: r })
}

/** 导出当前筛选结果（真实 CSV 下载） */
function exportDetail() {
  if (!filteredRows.value.length) {
    message.warning('当前没有可导出的商机')
    return
  }
  exportCsv(
    `销售漏斗商机明细-${stamp()}`,
    [
      { key: 'id', title: '商机编号' },
      { key: 'name', title: '商机名称' },
      { key: 'customer', title: '客户' },
      { key: 'stage', title: '阶段' },
      { key: 'amount', title: '金额(万)' },
      { key: 'probability', title: '赢率(%)' },
      { key: 'owner', title: '负责人' },
      { key: 'expectedClose', title: '预计成交' },
    ],
    filteredRows.value,
  )
  message.success(`已导出 ${filteredRows.value.length} 条商机明细`)
}
</script>

<template>
  <div class="page funnel-page">
    <div class="fn-head">
      <div>
        <h1>销售漏斗</h1>
        <p>从线索到成交的全链路转化分析与周期监控</p>
      </div>
      <div class="fn-tools">
        <a-select v-model:value="period" :options="periodOptions" style="width: 140px" />
        <a-button @click="exportDetail">
          <template #icon><AppIcon name="DownloadOutlined" :size="14" /></template>
          导出明细
        </a-button>
        <a-button @click="router.push('/crm/kanban')">
          <template #icon><AppIcon name="PartitionOutlined" :size="14" /></template>
          商机看板
        </a-button>
        <a-button type="primary" @click="run('新建商机', { pageKey: 'opportunity' })">
          <template #icon><AppIcon name="PlusOutlined" :size="14" /></template>
          新建商机
        </a-button>
      </div>
    </div>

    <!-- ============ 指标 ============ -->
    <div class="fn-kpi">
      <div class="fn-kpi-item">
        <span>商机总数</span><b class="num">{{ periodRows.length }}</b>
      </div>
      <div class="fn-kpi-item">
        <span>管道总额</span><b class="num">¥ {{ pipeline.toFixed(1) }} 万</b>
      </div>
      <div class="fn-kpi-item">
        <span>加权预测</span><b class="num">¥ {{ weighted.toFixed(1) }} 万</b>
      </div>
      <div class="fn-kpi-item">
        <span>平均赢率</span><b class="num">{{ avgRate.toFixed(1) }}%</b>
      </div>
    </div>

    <div class="fn-grid">
      <div class="card">
        <div class="card-hd">
          <h3>阶段转化漏斗</h3>
          <a class="fn-more" @click="router.push('/crm/opportunity')">查看全部商机</a>
        </div>
        <div class="card-bd">
          <BaseChart :option="funnelOption" :height="322" clickable @point-click="onFunnelClick" />
        </div>
      </div>

      <div class="card">
        <div class="card-hd">
          <h3>线索来源构成</h3>
          <span class="fn-hint">点击来源可筛选明细</span>
        </div>
        <div class="card-bd">
          <BaseChart :option="sourceOption" :height="230" clickable @point-click="onSourceClick" />
          <div class="fn-list">
            <button
              v-for="s in sourceStats"
              :key="s.name"
              class="fn-list-row"
              :class="{ active: focusSource === s.name }"
              @click="toggleSource(s.name)"
            >
              <span class="fn-list-name ellipsis">{{ s.name }}</span>
              <span class="fn-list-val num">{{ s.value }} 条</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="fn-grid">
      <div class="card fn-table-card">
        <div class="card-hd">
          <h3>阶段转化明细</h3>
          <span class="fn-hint">点击阶段行可筛选明细</span>
        </div>
        <div class="card-bd" style="padding: 0">
          <a-table
            :data-source="stageStats"
            :pagination="false"
            size="middle"
            row-key="name"
            :custom-row="(record: any) => ({ onClick: () => toggleStage(record.name) })"
            :row-class-name="(record: any) => (record.name === focusStage ? 'fn-row-active' : '')"
          >
            <a-table-column key="name" title="阶段" data-index="name" width="110" />
            <a-table-column key="count" title="数量" data-index="count" align="right" width="90" />
            <a-table-column key="amount" title="金额(万)" data-index="amount" align="right" width="110">
              <template #default="{ record }">{{ record.amount.toFixed(1) }}</template>
            </a-table-column>
            <a-table-column key="share" title="占比" align="right" width="86">
              <template #default="{ record }">{{ record.share.toFixed(1) }}%</template>
            </a-table-column>
            <a-table-column key="conv" title="阶段转化率" data-index="conv" align="right" width="110">
              <template #default="{ record }">
                <span :class="record.conv === '—' ? 'text-3' : 'conv'">{{ record.conv }}</span>
              </template>
            </a-table-column>
            <a-table-column key="cycle" title="平均成交周期" data-index="cycle" align="right" width="120" />
          </a-table>
        </div>
      </div>

      <div class="card">
        <div class="card-hd">
          <h3>销售代表业绩排行</h3>
          <span class="fn-hint">点击姓名可筛选明细</span>
        </div>
        <div class="card-bd">
          <BaseChart :option="repOption" :height="200" clickable @point-click="onRepClick" />
          <div class="fn-list">
            <button
              v-for="r in repStats.slice(0, 8)"
              :key="r.name"
              class="fn-list-row"
              :class="{ active: focusOwner === r.name }"
              @click="toggleOwner(r.name)"
            >
              <span class="fn-list-name ellipsis">{{ r.name }}</span>
              <span class="fn-list-sub num">{{ r.count }} 个</span>
              <span class="fn-list-val num">¥ {{ r.amount.toFixed(1) }} 万</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ============ 商机明细 ============ -->
    <div class="card fn-table-card">
      <div class="card-hd">
        <h3>商机明细</h3>
        <div class="fn-filters">
          <a-tag v-if="focusStage" color="processing" :bordered="false" closable @close="focusStage = ''">
            阶段：{{ focusStage }}
          </a-tag>
          <a-tag v-if="focusSource" color="processing" :bordered="false" closable @close="focusSource = ''">
            来源：{{ focusSource }}
          </a-tag>
          <a-tag v-if="focusOwner" color="processing" :bordered="false" closable @close="focusOwner = ''">
            负责人：{{ focusOwner }}
          </a-tag>
          <a v-if="hasFocus" class="fn-more" @click="clearFocus">清除筛选</a>
          <span class="fn-hint num">共 {{ filteredRows.length }} 条</span>
        </div>
      </div>
      <div class="card-bd" style="padding: 0">
        <a-table
          :columns="detailColumns"
          :data-source="filteredRows"
          :pagination="false"
          size="middle"
          row-key="id"
          :scroll="{ x: 'max-content' }"
        >
          <template #bodyCell="{ column, record }">
            <a v-if="column.key === 'id'" class="fn-cell-link" @click="openDetail(record)">
              {{ record.id }}
            </a>

            <span v-else-if="column.key === 'amount'" class="fn-cell-money num">
              {{ Number(record.amount || 0).toFixed(1) }}
            </span>

            <span v-else-if="column.key === 'probability'" class="num">
              {{ rateOf(record) }}%
            </span>

            <span v-else-if="column.key === '__action'" class="fn-row-actions">
              <a @click="onRowAction('推进阶段', record)">推进阶段</a>
              <a @click="onRowAction('报价', record)">报价</a>
              <a @click="onRowAction('转合同', record)">转合同</a>
              <a @click="onRowAction('详情', record)">详情</a>
            </span>

            <template v-else>{{ record[column.dataIndex] ?? '—' }}</template>
          </template>

          <template #emptyText>
            <a-empty description="当前筛选条件下没有商机" style="padding: 40px 0">
              <a-button v-if="hasFocus" size="small" @click="clearFocus">清除筛选</a-button>
            </a-empty>
          </template>
        </a-table>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default { name: 'Funnel' }
</script>

<style scoped>
.funnel-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.fn-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}
.fn-head h1 {
  margin: 0 0 5px;
  font-size: 20px;
  font-weight: 600;
}
.fn-head p {
  margin: 0;
  font-size: 13px;
  color: var(--text-3);
}
.fn-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* ---------- 指标 ---------- */
.fn-kpi {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.fn-kpi-item {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 13px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-shadow: var(--shadow-card);
}
.fn-kpi-item span {
  font-size: 12px;
  color: var(--text-3);
}
.fn-kpi-item b {
  font-size: 19px;
  font-weight: 600;
}

/* ---------- 网格 ---------- */
.fn-grid {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: 12px;
}
.fn-table-card {
  overflow: hidden;
}
.fn-more {
  font-size: 12.5px;
  color: var(--text-3);
  cursor: pointer;
  white-space: nowrap;
}
.fn-more:hover {
  color: var(--brand-600);
}
.fn-hint {
  font-size: 12px;
  color: var(--text-3);
  white-space: nowrap;
}
.conv {
  color: var(--success);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

/* ---------- 可点选清单（来源 / 代表） ---------- */
.fn-list {
  margin-top: 10px;
  border-top: 1px solid var(--border-subtle);
  max-height: 168px;
  overflow-y: auto;
}
.fn-list-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 4px;
  border: none;
  border-bottom: 1px solid var(--border-subtle);
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-size: 12.5px;
  color: var(--text-2);
  transition: background-color var(--dur-base) var(--ease), color var(--dur-base) var(--ease);
}
.fn-list-row:last-child {
  border-bottom: none;
}
.fn-list-row:hover {
  background: var(--surface-hover);
  color: var(--text-1);
}
.fn-list-row.active {
  background: var(--brand-050);
  color: var(--brand-600);
}
.fn-list-name {
  flex: 1;
  min-width: 0;
}
.fn-list-sub {
  color: var(--text-4);
  font-size: 11.5px;
}
.fn-list-val {
  color: var(--text-1);
  font-weight: 500;
}

/* ---------- 明细表 ---------- */
.fn-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.fn-cell-link {
  color: var(--brand-600);
  cursor: pointer;
}
.fn-cell-link:hover {
  text-decoration: underline;
}
.fn-cell-money {
  font-weight: 500;
}
.fn-row-actions a {
  color: var(--brand-600);
  cursor: pointer;
  font-size: 12.5px;
  margin-right: 10px;
  white-space: nowrap;
}
.fn-row-actions a:hover {
  color: var(--brand-700);
}
.fn-table-card :deep(.fn-row-active > td) {
  background: var(--brand-050);
}
.fn-table-card :deep(tbody > tr) {
  cursor: pointer;
}

@media (max-width: 1180px) {
  .fn-grid {
    grid-template-columns: 1fr;
  }
}
</style>
