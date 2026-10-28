<script setup lang="ts">
/**
 * CRM 商机看板
 * ---------------------------------------------------------------------------
 * 数据源：`stores/data.ts` 里 opportunity 页签的实时数据，别处新建 / 修改的商机
 * 会立刻反映到看板、列表与顶部汇总条上。
 *
 * 交互：
 *   - HTML5 拖拽推进阶段（列高亮 + 卡片拖拽态反馈）
 *   - 卡片右上角操作菜单：推进阶段 / 报价 / 转合同 / 详情
 *   - 看板 / 列表双视图；列表模式下首列点开商机详情
 *   - 负责人筛选，选项来自真实数据
 *   - 顶部汇总（管道总额、加权预测、平均赢率、临近截止）由 store 实时计算
 */
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import AppIcon from '@/components/AppIcon.vue'
import { stagePool } from '@/mock/crm'
import { smStage } from '@/mock/pages'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import { useAction } from '@/composables/useAction'

const data = useDataStore()
const ui = useUiStore()
const { run } = useAction()

/* ---------------- 视图状态 ---------------- */
const viewMode = ref<'看板' | '列表'>('看板')
const ownerFilter = ref<string | undefined>(undefined)

/** 阶段定义：阶段名 + 标准赢率（与 actionRules 的阶段路径保持一致） */
const stages = stagePool

/** 阶段色阶：由浅到深表示阶段推进程度 */
const toneColors = ['#94BFFF', '#3491FA', '#165DFF', '#0E42D2', '#0B35AC']

/** 全部商机（响应式） */
const allRows = computed<any[]>(() => data.rows('opportunity'))

/** 负责人筛选项：来自 store 的真实数据 */
const ownerOptions = computed(() => {
  const set = new Set<string>()
  for (const o of allRows.value) if (o.owner) set.add(o.owner)
  return [...set].sort().map((o) => ({ label: o, value: o }))
})

/** 当前结果集（受负责人筛选影响） */
const filtered = computed<any[]>(() =>
  ownerFilter.value ? allRows.value.filter((o) => o.owner === ownerFilter.value) : allRows.value,
)

/** 看板列：按阶段聚合当前结果集 */
const columns = computed(() =>
  stages.map((s, si) => {
    const items = filtered.value.filter((o) => o.stage === s.name)
    return {
      ...s,
      index: si,
      items,
      total: items.reduce((a, b) => a + Number(b.amount || 0), 0),
    }
  }),
)

/* ---------------- 汇总计算（全部来自 store 实时数据） ---------------- */

/** 阶段赢率：优先取阶段配置，兼容历史数据里的 probability 字段 */
function rateOf(op: any): number {
  const s = stages.find((x) => x.name === op.stage)
  if (s) return s.rate
  return Number(op.probability ?? op.stageRate ?? 0)
}

/** 在途商机：尚未推进到「合同签署」的商机 */
const inflight = computed(() => filtered.value.filter((o) => o.stage !== '合同签署'))

/** 管道总额 */
const pipeline = computed(() => inflight.value.reduce((a, o) => a + Number(o.amount || 0), 0))

/** 加权预测 = Σ(金额 × 阶段赢率) */
const weighted = computed(() =>
  inflight.value.reduce((a, o) => a + (Number(o.amount || 0) * rateOf(o)) / 100, 0),
)

/** 平均赢率（金额加权，与加权预测同源） */
const avgRate = computed(() => (pipeline.value ? (weighted.value / pipeline.value) * 100 : 0))

/** 临近截止：以管道中最早的预计成交日为「当下」参考点，统计其后 7 天内到期的商机 */
const dueSoon = computed(() => {
  const dates = inflight.value
    .map((o) => String(o.expectedClose ?? '').slice(0, 10))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
  if (!dates.length) return { count: 0, base: '—' }
  const base = dates[0]
  const limit = fmtDate(addDays(parseDate(base), 7))
  return { count: dates.filter((d) => d >= base && d <= limit).length, base }
})

/* ---------------- 日期工具 ---------------- */
function parseDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return new Date()
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d.getTime())
  x.setDate(x.getDate() + n)
  return x
}
function fmtDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/* ---------------- 拖拽推进阶段 ---------------- */
/** 正在拖拽的商机 id */
const dragId = ref<string>('')
/** 当前悬停的列（droppable 高亮） */
const dragOverKey = ref<string>('')

function onDragStart(e: DragEvent, op: any) {
  dragId.value = op.id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', op.id)
  }
}

function onDragEnd() {
  dragId.value = ''
  dragOverKey.value = ''
}

/** 悬停到列上：标记为可放置目标 */
function onDragOver(e: DragEvent, col: any) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOverKey.value = col.key
}

/** 离开整列才取消高亮（在列内子元素间移动不算离开） */
function onDragLeave(e: DragEvent) {
  const cur = e.currentTarget as HTMLElement | null
  const rel = e.relatedTarget as HTMLElement | null
  if (!rel || !cur || !cur.contains(rel)) dragOverKey.value = ''
}

function onDrop(e: DragEvent, col: any) {
  e.preventDefault()
  const id = e.dataTransfer?.getData('text/plain') || dragId.value
  const op = allRows.value.find((r) => r.id === id)
  dragId.value = ''
  dragOverKey.value = ''
  if (!op) return
  moveToStage(op, col.name)
}

/** 落位：改写 stage 并同步赢率字段 */
function moveToStage(op: any, stageName: string) {
  const from = op.stage
  if (from === stageName) {
    message.info(`「${op.name}」已在「${stageName}」阶段`)
    return
  }
  const fromIdx = stages.findIndex((s) => s.name === from)
  const toIdx = stages.findIndex((s) => s.name === stageName)
  const target = stages[toIdx]
  // 阶段 + 赢率一起写入，保证详情、列表与看板口径一致
  data.updateRow('opportunity', op.id, {
    stage: stageName,
    stageRate: target?.rate ?? op.stageRate,
    probability: target?.rate ?? op.probability,
  })
  if (toIdx > fromIdx) message.success(`已从「${from}」推进至「${stageName}」`)
  else message.success(`已从「${from}」调整至「${stageName}」`)
}

/** 阶段变动后同步赢率字段（拖拽、「推进阶段」动作都会改 stage） */
watch(
  () => allRows.value.map((r) => `${r.id}:${r.stage}`).join(','),
  () => {
    for (const r of allRows.value) {
      const s = stages.find((x) => x.name === r.stage)
      if (s && (r.stageRate !== s.rate || r.probability !== s.rate)) {
        data.updateRow('opportunity', r.id, { stageRate: s.rate, probability: s.rate })
      }
    }
  },
)

/* ---------------- 卡片与行操作 ---------------- */
/** 点击卡片主体：打开商机详情 */
function onCardClick(op: any) {
  ui.openDetail('opportunity', op)
}

/**
 * 转化单据（报价单 / 合同）时用的源记录。
 * 商机的「创建时间」是日期粒度（2025-07-17），而报价单的「创建时间」是
 * 日期时间粒度（YYYY-MM-DD HH:mm），原样带过去会显示 Invalid Date；
 * 这里去掉该字段，由公共表单按当前时间自动补齐。
 */
function convertSource(op: any): any {
  const r = { ...op }
  delete r.createdAt
  return r
}

/** 卡片菜单 / 列表行操作：统一走动作语义表 */
function onRowAction(name: string, op: any) {
  // 推进阶段 / 详情必须传原始行（阶段推进要落回 store），转化类动作传净化后的副本
  const row = name === '推进阶段' || name === '详情' ? op : convertSource(op)
  run(name, { pageKey: 'opportunity', row })
}

/* ---------------- 列表视图 ---------------- */
const listColumns = computed(() => [
  { key: 'id', title: '编号', dataIndex: 'id', width: 116 },
  { key: 'name', title: '商机名称', dataIndex: 'name', width: 260 },
  { key: 'customer', title: '客户', dataIndex: 'customer', width: 200 },
  { key: 'amount', title: '金额', dataIndex: 'amount', width: 130, align: 'right' },
  { key: 'stage', title: '阶段', dataIndex: 'stage', width: 106 },
  { key: 'owner', title: '负责人', dataIndex: 'owner', width: 100 },
  { key: 'expectedClose', title: '预计成交日期', dataIndex: 'expectedClose', width: 130 },
  { key: '__action', title: '操作', width: 220, align: 'left' },
])

/** 阶段标签配色 */
function stageColor(stage: string) {
  return smStage[stage]?.color ?? 'default'
}
</script>

<template>
  <div class="page kanban-page">
    <div class="kb-head">
      <div>
        <h1>商机看板</h1>
        <p>按阶段查看商机管道分布，支持拖拽推进阶段</p>
      </div>
      <div class="kb-tools">
        <a-select
          v-model:value="ownerFilter"
          :options="ownerOptions"
          placeholder="全部负责人"
          allow-clear
          style="width: 148px"
        />
        <a-radio-group v-model:value="viewMode" size="small" button-style="solid">
          <a-radio-button value="看板">看板</a-radio-button>
          <a-radio-button value="列表">列表</a-radio-button>
        </a-radio-group>
        <a-button type="primary" @click="run('新建商机', { pageKey: 'opportunity' })">
          <template #icon><AppIcon name="PlusOutlined" :size="14" /></template>
          新建商机
        </a-button>
      </div>
    </div>

    <!-- 汇总条：全部由 store 实时计算 -->
    <div class="kb-summary">
      <div class="kb-sum-item">
        <span>在途商机</span><b class="num">{{ inflight.length }}</b>
      </div>
      <div class="kb-sum-item">
        <span>管道总额</span><b class="num">¥ {{ pipeline.toFixed(1) }} 万</b>
      </div>
      <div class="kb-sum-item">
        <span>加权预测</span><b class="num">¥ {{ weighted.toFixed(1) }} 万</b>
      </div>
      <div class="kb-sum-item">
        <span>平均赢率</span><b class="num">{{ avgRate.toFixed(1) }}%</b>
      </div>
      <div class="kb-sum-item warn" :title="`以管道最早预计成交日 ${dueSoon.base} 为基准，统计 7 天内到期的商机`">
        <span>临近截止（7 天）</span><b class="num">{{ dueSoon.count }}</b>
      </div>
    </div>

    <!-- ============ 看板视图 ============ -->
    <div v-if="viewMode === '看板'" class="kb-board">
      <div
        v-for="col in columns"
        :key="col.key"
        class="kb-col"
        :class="{ droppable: dragOverKey === col.key }"
        @dragover="onDragOver($event, col)"
        @dragleave="onDragLeave($event)"
        @drop="onDrop($event, col)"
      >
        <div class="kb-col-hd">
          <span class="kb-dot" :style="{ background: toneColors[col.index] }" />
          <span class="kb-col-name">{{ col.name }}</span>
          <span class="kb-col-count num">{{ col.items.length }}</span>
          <span class="kb-col-rate">{{ col.rate }}%</span>
        </div>
        <div class="kb-col-sum">
          ¥ {{ col.total.toFixed(1) }} 万
        </div>

        <div class="kb-col-body">
          <div
            v-for="op in col.items"
            :key="op.id"
            class="kb-card"
            :class="{ dragging: dragId === op.id }"
            draggable="true"
            @dragstart="onDragStart($event, op)"
            @dragend="onDragEnd"
            @click="onCardClick(op)"
          >
            <div class="kb-card-top">
              <span class="kb-card-id">{{ op.id }}</span>
              <!-- 操作菜单：点击不冒泡到卡片，避免误开详情 -->
              <a-dropdown placement="bottomRight" trigger="click">
                <span class="kb-more" @click.stop @mousedown.stop.prevent>
                  <AppIcon name="MoreOutlined" :size="14" />
                </span>
                <template #overlay>
                  <a-menu>
                    <a-menu-item key="advance" @click.stop="onRowAction('推进阶段', op)">推进阶段</a-menu-item>
                    <a-menu-item key="quote" @click.stop="onRowAction('报价', op)">报价</a-menu-item>
                    <a-menu-item key="contract" @click.stop="onRowAction('转合同', op)">转合同</a-menu-item>
                    <a-menu-divider />
                    <a-menu-item key="detail" @click.stop="onRowAction('详情', op)">详情</a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </div>
            <div class="kb-card-title">{{ op.name }}</div>
            <div class="kb-card-cust ellipsis">{{ op.customer }}</div>
            <div class="kb-card-amt">¥ {{ Number(op.amount || 0).toFixed(1) }} 万</div>
            <div class="kb-card-foot">
              <a-avatar :size="20" style="background: #165dff; font-size: 11px">
                {{ String(op.owner || '').slice(0, 1) }}
              </a-avatar>
              <span class="kb-owner">{{ op.owner }}</span>
              <span class="kb-date">{{ String(op.expectedClose || '').slice(5) }}</span>
            </div>
          </div>

          <div v-if="!col.items.length" class="kb-empty">暂无商机</div>
        </div>
      </div>
    </div>

    <!-- ============ 列表视图 ============ -->
    <div v-else class="card kb-list-card">
      <div class="card-hd">
        <h3>商机列表</h3>
        <span class="kb-list-count num">共 {{ filtered.length }} 条</span>
      </div>
      <div class="card-bd" style="padding: 0">
        <a-table
          :columns="listColumns"
          :data-source="filtered"
          :pagination="false"
          size="middle"
          row-key="id"
          :scroll="{ x: 'max-content' }"
        >
          <template #bodyCell="{ column, record }">
            <!-- 编号：点开详情 -->
            <a v-if="column.key === 'id'" class="kb-cell-link" @click="onCardClick(record)">
              {{ record.id }}
            </a>

            <span v-else-if="column.key === 'amount'" class="kb-cell-money num">
              ¥ {{ Number(record.amount || 0).toFixed(1) }} 万
            </span>

            <a-tag v-else-if="column.key === 'stage'" :color="stageColor(record.stage)" :bordered="false">
              {{ record.stage }}
            </a-tag>

            <!-- 行操作 -->
            <span v-else-if="column.key === '__action'" class="kb-row-actions">
              <a @click="onRowAction('推进阶段', record)">推进阶段</a>
              <a @click="onRowAction('报价', record)">报价</a>
              <a @click="onRowAction('转合同', record)">转合同</a>
              <a @click="onRowAction('详情', record)">详情</a>
            </span>

            <template v-else>{{ record[column.dataIndex] ?? '—' }}</template>
          </template>

          <template #emptyText>
            <a-empty description="暂无符合条件的商机" style="padding: 40px 0" />
          </template>
        </a-table>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default { name: 'Kanban' }
</script>

<style scoped>
.kanban-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100%;
}
.kb-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}
.kb-head h1 {
  margin: 0 0 5px;
  font-size: 20px;
  font-weight: 600;
}
.kb-head p {
  margin: 0;
  font-size: 13px;
  color: var(--text-3);
}
.kb-tools {
  display: flex;
  gap: 8px;
  align-items: center;
}

.kb-summary {
  display: flex;
  gap: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 13px 4px;
  box-shadow: var(--shadow-card);
}
.kb-sum-item {
  flex: 1;
  padding: 0 18px;
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.kb-sum-item:last-child {
  border-right: none;
}
.kb-sum-item span {
  font-size: 12px;
  color: var(--text-3);
}
.kb-sum-item b {
  font-size: 18px;
  font-weight: 600;
}
.kb-sum-item.warn b {
  color: var(--warning);
}

.kb-board {
  display: grid;
  grid-template-columns: repeat(5, minmax(230px, 1fr));
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 8px;
  flex: 1;
  min-height: 0;
}
.kb-col {
  background: var(--surface-sunken);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-lg);
  display: flex;
  flex-direction: column;
  min-height: 380px;
  transition: border-color var(--dur-base) var(--ease), background-color var(--dur-base) var(--ease),
    box-shadow var(--dur-base) var(--ease);
}
/* 可放置目标：拖拽经过时高亮 */
.kb-col.droppable {
  border-color: var(--brand-500);
  background: var(--brand-050);
  box-shadow: inset 0 0 0 1px var(--brand-100);
}
.kb-col-hd {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 12px 13px 4px;
}
.kb-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.kb-col-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}
.kb-col-count {
  font-size: 11.5px;
  color: var(--text-3);
  background: rgba(0, 0, 0, 0.05);
  border-radius: var(--r-full);
  padding: 0 6px;
  line-height: 17px;
}
.kb-col-rate {
  margin-left: auto;
  font-size: 11.5px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}
.kb-col-sum {
  padding: 0 13px 10px;
  font-size: 12px;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}
.kb-col-body {
  padding: 0 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  flex: 1;
}
.kb-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 11px 12px;
  cursor: grab;
  box-shadow: 0 1px 2px rgba(29, 35, 41, 0.04);
  transition: box-shadow var(--dur-base) var(--ease), transform var(--dur-base) var(--ease),
    opacity var(--dur-base) var(--ease);
}
.kb-card:hover {
  box-shadow: 0 4px 14px rgba(29, 35, 41, 0.09);
  transform: translateY(-1px);
}
/* 拖拽中的卡片：半透明 + 抬升阴影 */
.kb-card.dragging {
  opacity: 0.55;
  box-shadow: 0 8px 20px rgba(29, 35, 41, 0.16);
  transform: rotate(-1deg);
  cursor: grabbing;
}
.kb-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.kb-card-id {
  font-size: 11px;
  color: var(--text-4);
  font-variant-numeric: tabular-nums;
}
.kb-more {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: var(--r-sm);
  color: var(--text-4);
  cursor: pointer;
  transition: background-color var(--dur-base) var(--ease), color var(--dur-base) var(--ease);
}
.kb-more:hover {
  background: var(--surface-hover);
  color: var(--text-2);
}
.kb-card-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-1);
  margin: 5px 0 3px;
  line-height: 1.45;
}
.kb-card-cust {
  font-size: 12px;
  color: var(--text-3);
  margin-bottom: 8px;
}
.kb-card-amt {
  font-size: 15px;
  font-weight: 600;
  color: var(--brand-600);
  font-variant-numeric: tabular-nums;
  margin-bottom: 9px;
}
.kb-card-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--border-subtle);
}
.kb-owner {
  font-size: 11.5px;
  color: var(--text-2);
}
.kb-date {
  margin-left: auto;
  font-size: 11.5px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}
.kb-empty {
  text-align: center;
  color: var(--text-4);
  font-size: 12.5px;
  padding: 30px 0;
}

/* ---------- 列表视图 ---------- */
.kb-list-card {
  overflow: hidden;
}
.kb-list-count {
  font-size: 12.5px;
  color: var(--text-3);
}
.kb-cell-link {
  color: var(--brand-600);
  cursor: pointer;
}
.kb-cell-link:hover {
  text-decoration: underline;
}
.kb-cell-money {
  font-weight: 500;
}
.kb-row-actions a {
  color: var(--brand-600);
  cursor: pointer;
  font-size: 12.5px;
  margin-right: 10px;
  white-space: nowrap;
}
.kb-row-actions a:hover {
  color: var(--brand-700);
}
</style>
