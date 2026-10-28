<script setup lang="ts">
/**
 * OA 协同办公 · 待办中心
 * ---------------------------------------------------------------------------
 * 待办数据全部来自全局仓库（pageKey = 'approval'，状态 = 审批中）：
 *  - 通过 / 驳回 / 批量通过会真实改写单据状态与处理人，并在消息中心留痕；
 *  - 顶部 KPI、待办条数、未读数全部由数据实时计算，不写死；
 *  - 详情走全局详情抽屉。
 */
import { computed, ref } from 'vue'
import { message } from 'ant-design-vue'
import { confirmDialog } from '@/utils/confirm'
import AppIcon from '@/components/AppIcon.vue'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import { useUserStore } from '@/stores/user'

const data = useDataStore()
const ui = useUiStore()
const user = useUserStore()

/** 审批类型分类 */
const types = ['全部', '费用报销', '请假申请', '采购申请', '合同用印', '出差申请']
const activeType = ref('全部')
/** 已勾选的单号 */
const selected = ref<string[]>([])

interface TodoItem {
  id: string
  raw: any
  type: string
  title: string
  from: string
  arriveAt: string
  amount: number
  urgency: string
  currentNode: string
  waitHours: number
  read: boolean
}

/** 当前时间文本 */
function nowText() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 从单号尾部取序号，作为稳定推导的种子（保证每次渲染结果一致） */
function seqOf(id: any) {
  const m = String(id ?? '').match(/(\d+)\s*$/)
  return m ? Number(m[1]) : 0
}

/** 等待时长：优先取已有字段，否则按单号序号稳定推导 */
function waitHoursOf(row: any) {
  if (row.waitHours !== undefined && row.waitHours !== null && row.waitHours !== '') {
    return Number(row.waitHours)
  }
  return (seqOf(row.id) * 7) % 96 + 1
}

/** 来源：申请人 + 所属部门 */
function fromOf(row: any) {
  return row.from || `${row.applicant ?? '—'} · ${row.dept ?? '—'}`
}

/** 到达时间：取提交时间 */
function arriveAtOf(row: any) {
  return row.arriveAt || row.submitAt || '—'
}

/** 处理时间：真实处理过的取处理时间，历史存量按单号序号折算到最近一周内 */
function handledAtOf(row: any) {
  if (row.handledAt) return new Date(String(row.handledAt).replace(/-/g, '/'))
  const d = new Date()
  d.setDate(d.getDate() - (seqOf(row.id) % 7))
  d.setHours(10, 0, 0, 0)
  return d
}

/** 单据耗时（小时） */
function durationHoursOf(row: any) {
  const m = String(row.duration ?? '').match(/[\d.]+/)
  return m ? Number(m[0]) : 0
}

/** 待我审批的全部单据 */
const pending = computed<any[]>(() =>
  data.rows('approval').filter((r: any) => r.status === '审批中'),
)

/** 当前分类下展示的待办（按等待时长倒序） */
const list = computed<TodoItem[]>(() => {
  let rows = pending.value
  if (activeType.value !== '全部') rows = rows.filter((r: any) => r.type === activeType.value)
  return [...rows]
    .sort((a, b) => waitHoursOf(b) - waitHoursOf(a))
    .map((r) => ({
      id: r.id,
      raw: r,
      type: r.type ?? '—',
      title: r.title ?? '—',
      from: fromOf(r),
      arriveAt: arriveAtOf(r),
      amount: Number(r.amount) || 0,
      urgency: r.urgency ?? '普通',
      currentNode: r.currentNode ?? '—',
      waitHours: waitHoursOf(r),
      read: r.read === '已读',
    }))
})

/** 未读待办数 */
const unreadCount = computed(() => pending.value.filter((r: any) => r.read !== '已读').length)

/** 即将超时（超过 48 小时未处理） */
const urgentCount = computed(() => pending.value.filter((r: any) => waitHoursOf(r) >= 48).length)

/** 已处理（通过 / 驳回） */
const processed = computed<any[]>(() =>
  data.rows('approval').filter((r: any) => r.status === '已通过' || r.status === '已驳回'),
)

/** 本周已处理：处理时间落在最近 7 天 */
const handledThisWeek = computed(
  () => processed.value.filter((r: any) => Date.now() - handledAtOf(r).getTime() <= 7 * 864e5).length,
)

/** 平均处理时长 */
const avgDuration = computed(() => {
  const vals = processed.value.map(durationHoursOf).filter((v) => v > 0)
  if (!vals.length) return '—'
  return `${(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)} h`
})

/** 顶部指标卡（全部实时计算） */
const kpis = computed(() => [
  { label: '待我审批', value: String(pending.value.length), icon: 'AuditOutlined', tone: 'warning' },
  { label: '即将超时', value: String(urgentCount.value), icon: 'ExclamationCircleOutlined', tone: 'danger' },
  { label: '本周已处理', value: String(handledThisWeek.value), icon: 'CheckCircleOutlined', tone: 'success' },
  { label: '平均处理时长', value: avgDuration.value, icon: 'ClockCircleOutlined', tone: 'brand' },
])

/** 全选状态 */
const allChecked = computed(
  () => list.value.length > 0 && list.value.every((t) => selected.value.includes(t.id)),
)
const someChecked = computed(
  () => list.value.some((t) => selected.value.includes(t.id)) && !allChecked.value,
)

/** 勾选 / 取消勾选单条 */
function toggleRow(id: string, checked: boolean) {
  if (checked) {
    if (!selected.value.includes(id)) selected.value = [...selected.value, id]
  } else {
    selected.value = selected.value.filter((x) => x !== id)
  }
}

/** 全选 / 取消全选当前列表 */
function toggleAll(e: any) {
  const ids = list.value.map((t) => t.id)
  if (e?.target?.checked) {
    selected.value = Array.from(new Set([...selected.value, ...ids]))
  } else {
    const set = new Set(ids)
    selected.value = selected.value.filter((id) => !set.has(id))
  }
}

/** 在消息中心留痕 */
function trail(title: string) {
  data.addRow('message', {
    title,
    type: '审批提醒',
    from: user.user.name,
    priority: '重要',
    read: '未读',
    sendAt: nowText(),
  })
}

/** 通过：确认后真正改写状态与处理人 */
function approve(t: TodoItem) {
  confirmDialog({
    title: '确认通过审批',
    content: `单号 ${t.id} · ${t.title} · 金额 ¥ ${t.amount.toFixed(2)}`,
    okText: '通过',
    cancelText: '取消',
    onOk: () => {
      data.updateRow('approval', t.id, {
        status: '已通过',
        approver: user.user.name,
        handledAt: nowText(),
        duration: `${t.waitHours} 小时`,
        read: '已读',
      })
      trail(`审批已通过：${t.title}`)
      selected.value = selected.value.filter((id) => id !== t.id)
      message.success(`已通过：${t.title}`)
    },
  })
}

/** 驳回：确认后真正改写状态与处理人 */
function reject(t: TodoItem) {
  confirmDialog({
    title: '驳回审批',
    content: `单号 ${t.id} · ${t.title} · 驳回后将通知申请人 ${t.raw.applicant ?? '—'}`,
    okText: '确认驳回',
    okType: 'danger',
    cancelText: '取消',
    onOk: () => {
      data.updateRow('approval', t.id, {
        status: '已驳回',
        approver: user.user.name,
        handledAt: nowText(),
        duration: `${t.waitHours} 小时`,
        read: '已读',
      })
      trail(`审批已驳回：${t.title}`)
      selected.value = selected.value.filter((id) => id !== t.id)
      message.success(`已驳回并通知申请人：${t.title}`)
    },
  })
}

/** 批量通过：逐条改状态、记处理人、消息留痕 */
function batchApprove() {
  const targets = pending.value.filter((r: any) => selected.value.includes(r.id))
  if (!targets.length) {
    message.warning('请先勾选需要通过的待办事项')
    return
  }
  confirmDialog({
    title: '批量通过审批',
    content: `将一次性通过 ${targets.length} 条待办，处理人记为 ${user.user.name}。`,
    okText: `通过 ${targets.length} 条`,
    cancelText: '取消',
    onOk: () => {
      let n = 0
      for (const r of targets) {
        const row = data.updateRow('approval', r.id, {
          status: '已通过',
          approver: user.user.name,
          handledAt: nowText(),
          duration: `${waitHoursOf(r)} 小时`,
          read: '已读',
        })
        if (!row) continue
        n++
        trail(`审批已通过：${r.title}`)
      }
      selected.value = []
      message.success(`已批量通过 ${n} 条`)
    },
  })
}

/** 全部已读：清掉待办与站内消息的未读标记 */
function markAllRead() {
  let n = 0
  for (const r of pending.value) {
    if (r.read !== '已读') {
      r.read = '已读'
      n++
    }
  }
  let m = 0
  for (const r of data.rows('message')) {
    if (r.read === '未读') {
      r.read = '已读'
      m++
    }
  }
  message.success(n || m ? `已标记 ${n} 条待办、${m} 条站内消息为已读` : '暂无未读内容')
}

/** 详情：走全局详情抽屉 */
function openDetail(t: TodoItem) {
  ui.openDetail('approval', t.raw)
}

/** 是否即将超时 */
function urgent(t: number) {
  return t >= 48
}
</script>

<template>
  <div class="page todo-page">
    <div class="td-head">
      <div>
        <h1>待办中心</h1>
        <p>集中处理需要我审批的事项，超时将自动升级至上级</p>
      </div>
      <a-space>
        <a-badge :count="unreadCount" :overflow-count="99" :offset="[-6, 2]">
          <a-button @click="markAllRead">
            <template #icon><AppIcon name="ReadOutlined" :size="14" /></template>
            全部已读
          </a-button>
        </a-badge>
        <a-button type="primary" :disabled="!selected.length" @click="batchApprove">
          <template #icon><AppIcon name="CheckCircleOutlined" :size="14" /></template>
          批量通过 ({{ selected.length }})
        </a-button>
      </a-space>
    </div>

    <div class="td-kpi">
      <div v-for="k in kpis" :key="k.label" class="td-k">
        <span class="td-k-ico" :class="k.tone"><AppIcon :name="k.icon" :size="15" /></span>
        <div>
          <div class="td-k-label">{{ k.label }}</div>
          <div class="td-k-val num">{{ k.value }}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="td-tabs">
        <a-radio-group v-model:value="activeType" size="small" button-style="solid">
          <a-radio-button v-for="t in types" :key="t" :value="t">{{ t }}</a-radio-button>
        </a-radio-group>
        <div class="td-tools">
          <a-checkbox :checked="allChecked" :indeterminate="someChecked" @change="toggleAll">全选</a-checkbox>
          <span class="td-sel">已选 {{ selected.length }} / {{ list.length }} 条</span>
        </div>
      </div>

      <div class="td-list">
        <div v-for="t in list" :key="t.id" class="td-item" :class="{ urgent: urgent(t.waitHours) }">
          <a-checkbox
            :checked="selected.includes(t.id)"
            @change="(e: any) => toggleRow(t.id, e.target.checked)"
          />
          <span class="td-type">{{ t.type }}</span>
          <div class="td-main">
            <div class="td-title">
              <span v-if="!t.read" class="td-dot" title="未读" />
              {{ t.title }}
              <a-tag v-if="t.urgency !== '普通'" color="error" :bordered="false">{{ t.urgency }}</a-tag>
            </div>
            <div class="td-meta">
              <span>{{ t.from }}</span>
              <span class="dot">·</span>
              <span>当前节点：{{ t.currentNode }}</span>
              <span class="dot">·</span>
              <span>提交于 {{ t.arriveAt }}</span>
            </div>
          </div>
          <div class="td-amt">
            <span v-if="t.amount > 0" class="num">¥ {{ t.amount.toFixed(2) }}</span>
            <span v-else class="text-3">—</span>
          </div>
          <div class="td-wait" :class="{ warn: urgent(t.waitHours) }">
            <AppIcon name="ClockCircleOutlined" :size="12" /> 等待 {{ t.waitHours }}h
          </div>
          <div class="td-actions">
            <a-button size="small" @click="reject(t)">驳回</a-button>
            <a-button size="small" type="primary" @click="approve(t)">通过</a-button>
            <a-button size="small" type="text" @click="openDetail(t)">详情</a-button>
          </div>
        </div>

        <a-empty v-if="!list.length" description="当前分类下没有待办事项" style="padding: 50px 0" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.todo-page { display: flex; flex-direction: column; gap: 12px; }
.td-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.td-head h1 { margin: 0 0 5px; font-size: 20px; font-weight: 600; }
.td-head p { margin: 0; font-size: 13px; color: var(--text-3); }

.td-kpi { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
.td-k {
  display: flex; align-items: center; gap: 11px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: 13px 15px; box-shadow: var(--shadow-card);
}
.td-k-ico { width: 34px; height: 34px; border-radius: var(--r-md); display: flex; align-items: center; justify-content: center; }
.td-k-ico.brand { background: var(--brand-050); color: var(--brand-600); }
.td-k-ico.success { background: var(--success-bg); color: var(--success); }
.td-k-ico.warning { background: var(--warning-bg); color: var(--warning); }
.td-k-ico.danger { background: var(--danger-bg); color: var(--danger); }
.td-k-label { font-size: 12px; color: var(--text-3); }
.td-k-val { font-size: 20px; font-weight: 600; font-variant-numeric: tabular-nums; }

.card { overflow: hidden; }
.td-tabs {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  flex-wrap: wrap;
  padding: 14px 18px; border-bottom: 1px solid var(--border-subtle);
}
.td-tools { display: flex; align-items: center; gap: 14px; }
.td-sel { font-size: 12px; color: var(--text-3); font-variant-numeric: tabular-nums; }
.td-list { padding: 4px 0; }
.td-item {
  display: grid;
  grid-template-columns: 20px 96px minmax(0, 1fr) 118px 108px 186px;
  align-items: center;
  gap: 12px;
  padding: 13px 18px;
  border-bottom: 1px solid var(--border-subtle);
  transition: background-color var(--dur-base) var(--ease);
}
.td-item:last-child { border-bottom: none; }
.td-item:hover { background: var(--surface-hover); }
.td-item.urgent { background: linear-gradient(90deg, rgba(245, 63, 63, 0.04), transparent 42%); }
.td-item.urgent:hover { background: linear-gradient(90deg, rgba(245, 63, 63, 0.07), transparent 42%); }
.td-type {
  font-size: 12px; text-align: center; padding: 3px 0;
  border-radius: var(--r-sm); background: var(--brand-050); color: var(--brand-600);
}
.td-main { min-width: 0; }
.td-title { font-size: 13.5px; color: var(--text-1); display: flex; align-items: center; gap: 7px; }
.td-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--brand-600); flex: none; }
.td-meta { font-size: 11.5px; color: var(--text-3); margin-top: 3px; display: flex; gap: 6px; flex-wrap: wrap; }
.td-meta .dot { color: var(--border-strong); }
.td-amt { text-align: right; font-size: 13.5px; font-weight: 600; font-variant-numeric: tabular-nums; }
.td-wait { font-size: 12px; color: var(--text-3); display: flex; align-items: center; gap: 4px; }
.td-wait.warn { color: var(--danger); }
.td-actions { display: flex; gap: 6px; justify-content: flex-end; }

@media (max-width: 1280px) {
  .td-item { grid-template-columns: 20px 96px minmax(0, 1fr) 110px 186px; }
  .td-wait { display: none; }
}
</style>
