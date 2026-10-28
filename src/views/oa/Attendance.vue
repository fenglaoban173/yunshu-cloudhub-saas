<script setup lang="ts">
/**
 * OA 协同办公 · 考勤管理
 * ---------------------------------------------------------------------------
 * 考勤明细由本页本地响应式 state 维护（按「部门 + 月份」确定性生成）：
 *  - 批量处理：弹窗勾选异常记录，统一补齐 09:00 / 18:00 打卡并置为正常；
 *  - 补卡申请：弹窗填写日期与上下班时间，改写当日记录并重算工时；
 *  - 顶部统计与导出均基于当前数据实时计算。
 */
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import AppIcon from '@/components/AppIcon.vue'
import { makeRng } from '@/mock/base'
import { useUserStore } from '@/stores/user'
import { exportCsv, stamp } from '@/utils/export'

const user = useUserStore()

type AttType = '正常' | '休息' | '迟到' | '缺卡' | '外勤'

interface AttRow {
  day: number
  date: string
  week: string
  type: AttType
  in: string
  out: string
  hours: number
  overtime: number
}

interface FixRecord {
  id: string
  date: string
  way: '补卡' | '批量处理'
  in: string
  out: string
  hours: number
  reason: string
  operator: string
  at: string
}

const month = ref('2025-10')
const scope = ref('研发中心')
/** 当前周期的考勤明细（响应式，改完立刻反映到日历与统计） */
const rows = ref<AttRow[]>([])
/** 补卡与批量处理记录 */
const records = ref<FixRecord[]>([])
/** 已生成过的周期数据缓存：切换月份再切回来时保留手工修正结果 */
const cache = new Map<string, AttRow[]>()

const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六']
/** 日历表头（周一为一周起点） */
const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const scopes = ['研发中心', '销售中心', '财务中心', '集团管理中心']

/** 当前时间文本 */
function nowText() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 字符串散列成随机种子 */
function seedOf(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 打卡时长（小时），扣除 1 小时午休 */
function hoursBetween(a: string, b: string) {
  const [ah, am] = a.split(':').map(Number)
  const [bh, bm] = b.split(':').map(Number)
  const mins = bh * 60 + bm - (ah * 60 + am) - 60
  return +(Math.max(mins, 0) / 60).toFixed(1)
}

/** 按「部门 + 月份」生成一份确定性的考勤明细 */
function buildMonth(dept: string, ym: string): AttRow[] {
  const [y, m] = (ym || '2025-10').split('-').map(Number)
  const days = new Date(y, m, 0).getDate()
  const r = makeRng(seedOf(`${dept}|${ym}`))
  const list: AttRow[] = []
  for (let day = 1; day <= days; day++) {
    const date = `${ym}-${String(day).padStart(2, '0')}`
    const week = WEEK_CN[new Date(y, m - 1, day).getDay()]
    if (week === '日' || week === '六') {
      list.push({ day, date, week, type: '休息', in: '—', out: '—', hours: 0, overtime: 0 })
      continue
    }
    const p = r()
    let type: AttType = '正常'
    if (p > 0.93) type = '缺卡'
    else if (p > 0.86) type = '迟到'
    else if (p > 0.78) type = '外勤'
    let inTime = '—'
    let outTime = '—'
    if (type !== '缺卡') {
      const inMin = type === '迟到' ? 9 * 60 + 12 + Math.floor(r() * 40) : 8 * 60 + Math.floor(r() * 60)
      const outMin = 18 * 60 + Math.floor(r() * 90)
      inTime = `${String(Math.floor(inMin / 60)).padStart(2, '0')}:${String(inMin % 60).padStart(2, '0')}`
      outTime = `${String(Math.floor(outMin / 60)).padStart(2, '0')}:${String(outMin % 60).padStart(2, '0')}`
    }
    list.push({
      day, date, week, type,
      in: inTime,
      out: outTime,
      hours: type === '缺卡' ? 0 : hoursBetween(inTime, outTime),
      overtime: r() > 0.76 ? +(1 + r() * 2.5).toFixed(1) : 0,
    })
  }
  return list
}

/** 载入某个周期的考勤明细（命中缓存则复用，保留手工修正） */
function loadRows(dept: string, ym: string) {
  const key = `${dept}|${ym}`
  const hit = cache.get(key)
  if (hit) {
    rows.value = hit
    return
  }
  const list = buildMonth(dept, ym)
  cache.set(key, list)
  rows.value = list
}

/** 切换部门 / 月份时重新载入 */
watch(
  [scope, month],
  () => loadRows(scope.value, month.value),
  { immediate: true },
)

/** 日历首列补空格数（周一为一周起点） */
const blanks = computed(() => {
  const [y, m] = month.value.split('-').map(Number)
  const first = new Date(y, m - 1, 1).getDay()
  return (first + 6) % 7
})

/** 顶部统计（全部实时计算） */
const stats = computed(() => {
  const work = rows.value.filter((r) => r.type !== '休息')
  const attended = work.filter((r) => r.type !== '缺卡')
  const late = work.filter((r) => r.type === '迟到').length
  const miss = work.filter((r) => r.type === '缺卡').length
  const overtime = rows.value.reduce((s, r) => s + r.overtime, 0)
  const avg = attended.length ? attended.reduce((s, r) => s + r.hours, 0) / attended.length : 0
  return [
    { label: '应出勤', value: String(work.length), unit: '天' },
    { label: '实际出勤', value: String(attended.length), unit: '天' },
    { label: '迟到', value: String(late), unit: '次', warn: late > 0 },
    { label: '缺卡', value: String(miss), unit: '次', warn: miss > 0 },
    { label: '加班时长', value: overtime.toFixed(1), unit: '小时' },
    { label: '平均工时', value: avg.toFixed(1), unit: '小时/天' },
  ]
})

/** 异常记录（迟到 / 缺卡 / 外勤） */
const abnormal = computed(() =>
  rows.value.filter((r) => ['迟到', '缺卡', '外勤'].includes(r.type)),
)

function cellClass(type: string) {
  if (type === '正常') return 'c-normal'
  if (type === '休息') return 'c-rest'
  if (type === '迟到') return 'c-late'
  if (type === '缺卡') return 'c-miss'
  return 'c-out'
}

/** 导出考勤明细 CSV */
function exportAttendance() {
  if (!rows.value.length) {
    message.warning('当前没有可导出的考勤数据')
    return
  }
  exportCsv(
    `考勤明细-${scope.value}-${month.value}`,
    [
      { key: 'date', title: '日期' },
      { key: 'week', title: '星期' },
      { key: 'type', title: '类型' },
      { key: 'in', title: '上班' },
      { key: 'out', title: '下班' },
      { key: 'hours', title: '工时' },
      { key: 'overtime', title: '加班' },
    ],
    rows.value,
  )
  message.success(`已导出 ${rows.value.length} 条考勤明细`)
}

/* --------------------------- 批量处理 --------------------------- */
const batchOpen = ref(false)
/** 批量处理勾选的日期 */
const batchSel = ref<string[]>([])

function openBatch() {
  if (!abnormal.value.length) {
    message.info('当前周期没有异常记录需要处理')
    return
  }
  batchSel.value = abnormal.value.map((r) => r.date)
  batchOpen.value = true
}

function toggleBatch(date: string, checked: boolean) {
  if (checked) {
    if (!batchSel.value.includes(date)) batchSel.value = [...batchSel.value, date]
  } else {
    batchSel.value = batchSel.value.filter((d) => d !== date)
  }
}

function confirmBatch() {
  const targets = rows.value.filter((r) => batchSel.value.includes(r.date) && r.type !== '休息')
  if (!targets.length) {
    message.warning('请先勾选需要处理的记录')
    return
  }
  for (const t of targets) {
    t.type = '正常'
    t.in = '09:00'
    t.out = '18:00'
    t.hours = hoursBetween('09:00', '18:00')
    records.value.unshift({
      id: `FX${String(records.value.length + 1).padStart(4, '0')}`,
      date: t.date,
      way: '批量处理',
      in: t.in,
      out: t.out,
      hours: t.hours,
      reason: '异常考勤批量补卡（标准工时）',
      operator: user.user.name,
      at: nowText(),
    })
  }
  batchOpen.value = false
  batchSel.value = []
  message.success(`已批量处理 ${targets.length} 条异常记录`)
}

/* --------------------------- 补卡申请 --------------------------- */
const fixOpen = ref(false)
/** 补卡目标记录 */
const fixTarget = ref<AttRow | null>(null)
const fixForm = ref({ date: '', in: '09:00', out: '18:00', reason: '' })

function openFix(row?: AttRow) {
  const target = row ?? abnormal.value[0]
  if (!target) {
    message.info('当前周期没有需要补卡的异常记录')
    return
  }
  fixTarget.value = target
  fixForm.value = {
    date: target.date,
    in: target.in === '—' ? '09:00' : target.in,
    out: target.out === '—' ? '18:00' : target.out,
    reason: '',
  }
  fixOpen.value = true
}

function confirmFix() {
  const target = fixTarget.value
  if (!target) return
  if (!fixForm.value.date) {
    message.warning('请选择补卡日期')
    return
  }
  if (!fixForm.value.in || !fixForm.value.out) {
    message.warning('请填写上下班打卡时间')
    return
  }
  if (!fixForm.value.reason.trim()) {
    message.warning('请填写补卡原因')
    return
  }
  const row = rows.value.find((r) => r.date === fixForm.value.date)
  if (!row) {
    message.warning('该日期不在当前考勤周期内，请选择本月的日期')
    return
  }
  row.type = '正常'
  row.in = fixForm.value.in
  row.out = fixForm.value.out
  row.hours = hoursBetween(row.in, row.out)
  records.value.unshift({
    id: `FX${String(records.value.length + 1).padStart(4, '0')}`,
    date: row.date,
    way: '补卡',
    in: row.in,
    out: row.out,
    hours: row.hours,
    reason: fixForm.value.reason.trim(),
    operator: user.user.name,
    at: nowText(),
  })
  fixOpen.value = false
  message.success(`补卡已生效：${row.date}`)
}
</script>

<template>
  <div class="page att-page">
    <div class="at-head">
      <div>
        <h1>考勤管理</h1>
        <p>{{ scope }} · {{ month }} 月度考勤日历、打卡明细与异常处理</p>
      </div>
      <a-space>
        <a-select v-model:value="scope" :options="scopes.map(v => ({ label: v, value: v }))" style="width: 140px" />
        <a-date-picker v-model:value="month" value-format="YYYY-MM" picker="month" style="width: 130px" />
        <a-button type="primary" @click="exportAttendance">
          <template #icon><AppIcon name="DownloadOutlined" :size="14" /></template>
          导出
        </a-button>
      </a-space>
    </div>

    <div class="at-kpi">
      <div v-for="s in stats" :key="s.label" class="at-k">
        <span class="at-k-label">{{ s.label }}</span>
        <span class="at-k-val num" :class="{ warn: s.warn }">{{ s.value }}<i>{{ s.unit }}</i></span>
      </div>
    </div>

    <div class="at-grid">
      <div class="card">
        <div class="card-hd">
          <h3>考勤日历</h3>
          <div class="legend">
            <span><i class="lg c-normal" />正常</span>
            <span><i class="lg c-rest" />休息</span>
            <span><i class="lg c-late" />迟到</span>
            <span><i class="lg c-miss" />缺卡</span>
            <span><i class="lg c-out" />外勤</span>
          </div>
        </div>
        <div class="card-bd">
          <div class="cal-hd">
            <div v-for="w in weekdays" :key="w" class="cal-wd">周{{ w }}</div>
          </div>
          <div class="cal-grid">
            <div class="cal-cell blank" v-for="b in blanks" :key="'b' + b" />
            <div
              v-for="r in rows"
              :key="r.date"
              class="cal-cell"
              :class="[cellClass(r.type), { 'cal-fixable': ['迟到', '缺卡', '外勤'].includes(r.type) }]"
              :title="['迟到', '缺卡', '外勤'].includes(r.type) ? '点击发起补卡' : ''"
              @click="['迟到', '缺卡', '外勤'].includes(r.type) && openFix(r)"
            >
              <div class="cal-day">{{ r.day }}</div>
              <div class="cal-type">{{ r.type }}</div>
              <div v-if="r.type === '休息'" class="cal-time dim">—</div>
              <div v-else-if="r.type === '缺卡'" class="cal-time dim">未打卡</div>
              <div v-else class="cal-time">{{ r.in }} - {{ r.out }}</div>
              <div v-if="r.overtime > 0" class="cal-ot">+{{ r.overtime }}h</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-hd">
          <h3>异常记录</h3>
          <a-space>
            <a class="more" @click="openBatch">批量处理</a>
            <a class="more" @click="openFix()">补卡申请</a>
          </a-space>
        </div>
        <div class="card-bd" style="padding: 0">
          <a-table :data-source="abnormal" :pagination="false" size="small" row-key="date">
            <a-table-column key="date" title="日期" data-index="date" width="104" />
            <a-table-column key="type" title="异常类型" data-index="type" width="96">
              <template #default="{ record }">
                <a-tag :color="record.type === '迟到' ? 'warning' : 'error'" :bordered="false">{{ record.type }}</a-tag>
              </template>
            </a-table-column>
            <a-table-column key="in" title="上班打卡" data-index="in" width="92" />
            <a-table-column key="out" title="下班打卡" data-index="out" width="92" />
            <a-table-column key="hours" title="工时" data-index="hours" width="76" align="right" />
            <a-table-column key="act" title="操作" width="82">
              <template #default="{ record }">
                <a class="more" @click="openFix(record)">补卡</a>
              </template>
            </a-table-column>
          </a-table>
          <a-empty v-if="!abnormal.length" description="当前周期没有异常记录" :image="undefined" style="padding: 26px 0" />
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-hd">
        <h3>补卡与批量处理记录</h3>
        <span class="cnt">共 {{ records.length }} 条</span>
      </div>
      <div class="card-bd" style="padding: 0">
        <a-table :data-source="records" :pagination="false" size="small" row-key="id">
          <a-table-column key="date" title="日期" data-index="date" width="110" />
          <a-table-column key="way" title="方式" data-index="way" width="104">
            <template #default="{ record }">
              <a-tag :color="record.way === '补卡' ? 'processing' : 'default'" :bordered="false">{{ record.way }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column key="time" title="打卡时间" width="150">
            <template #default="{ record }"><span class="num">{{ record.in }} - {{ record.out }}</span></template>
          </a-table-column>
          <a-table-column key="hours" title="工时" data-index="hours" width="76" align="right" />
          <a-table-column key="reason" title="原因" data-index="reason" ellipsis />
          <a-table-column key="operator" title="操作人" data-index="operator" width="90" />
          <a-table-column key="at" title="处理时间" data-index="at" width="150" />
        </a-table>
        <a-empty v-if="!records.length" description="暂无补卡记录" :image="undefined" style="padding: 26px 0" />
      </div>
    </div>

    <!-- 批量处理异常考勤 -->
    <a-modal
      v-model:open="batchOpen"
      title="批量处理异常考勤"
      ok-text="确认处理"
      cancel-text="取消"
      :width="560"
      @ok="confirmBatch"
    >
      <p class="md-tip">
        共 {{ abnormal.length }} 条异常记录，已选 {{ batchSel.length }} 条。确认后按 09:00 / 18:00 标准补齐打卡并置为「正常」。
      </p>
      <div class="ck-list">
        <div
          v-for="r in abnormal"
          :key="r.date"
          class="ck-item"
          :class="{ on: batchSel.includes(r.date) }"
          @click="toggleBatch(r.date, !batchSel.includes(r.date))"
        >
          <a-checkbox :checked="batchSel.includes(r.date)" @click.stop @change="(e: any) => toggleBatch(r.date, e.target.checked)" />
          <span class="ck-date num">{{ r.date }}</span>
          <span class="ck-week">周{{ r.week }}</span>
          <a-tag :color="r.type === '迟到' ? 'warning' : 'error'" :bordered="false">{{ r.type }}</a-tag>
          <span class="ck-time num">{{ r.in }} - {{ r.out }}</span>
        </div>
      </div>
    </a-modal>

    <!-- 补卡申请 -->
    <a-modal
      v-model:open="fixOpen"
      title="补卡申请"
      ok-text="提交补卡"
      cancel-text="取消"
      :width="520"
      @ok="confirmFix"
    >
      <a-form layout="vertical">
        <a-form-item label="补卡日期">
          <a-date-picker v-model:value="fixForm.date" value-format="YYYY-MM-DD" style="width: 100%" />
        </a-form-item>
        <div class="fix-row">
          <a-form-item label="上班时间">
            <a-time-picker v-model:value="fixForm.in" value-format="HH:mm" format="HH:mm" style="width: 100%" />
          </a-form-item>
          <a-form-item label="下班时间">
            <a-time-picker v-model:value="fixForm.out" value-format="HH:mm" format="HH:mm" style="width: 100%" />
          </a-form-item>
        </div>
        <a-form-item label="补卡原因">
          <a-textarea
            v-model:value="fixForm.reason"
            :rows="3"
            placeholder="请说明补卡原因，如：忘记打卡 / 外出办公 / 设备故障"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.att-page { display: flex; flex-direction: column; gap: 12px; }
.at-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.at-head h1 { margin: 0 0 5px; font-size: 20px; font-weight: 600; }
.at-head p { margin: 0; font-size: 13px; color: var(--text-3); }

.at-kpi { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
.at-k {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg);
  padding: 13px 15px; display: flex; flex-direction: column; gap: 6px; box-shadow: var(--shadow-card);
}
.at-k-label { font-size: 12px; color: var(--text-3); }
.at-k-val { font-size: 22px; font-weight: 600; }
.at-k-val i { font-style: normal; font-size: 12px; color: var(--text-3); font-weight: 400; margin-left: 3px; }
.at-k-val.warn { color: var(--warning); }

.at-grid { display: grid; grid-template-columns: 1.55fr 1fr; gap: 12px; align-items: start; }
.legend { display: flex; gap: 14px; }
.legend span { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text-3); }
.lg { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }
.lg.c-normal { background: #165DFF; }
.lg.c-rest { background: #E8EAED; }
.lg.c-late { background: #FF7D00; }
.lg.c-miss { background: #F53F3F; }
.lg.c-out { background: #722ED1; }

.cal-hd { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin-bottom: 6px; }
.cal-wd { text-align: center; font-size: 12px; color: var(--text-3); padding: 4px 0; }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
.cal-cell {
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-md);
  padding: 7px 6px 8px;
  min-height: 78px;
  position: relative;
  background: #fff;
}
.cal-cell.blank { background: transparent; border-color: transparent; }
.cal-cell.c-normal { background: #F4F8FF; border-color: #DCE9FF; }
.cal-cell.c-rest { background: #FAFBFC; border-color: var(--border-subtle); }
.cal-cell.c-late { background: #FFF9EF; border-color: #FFE3BC; }
.cal-cell.c-miss { background: #FFF3F1; border-color: #FFD6D0; }
.cal-cell.c-out { background: #F8F4FF; border-color: #E5DAFF; }
.cal-cell.cal-fixable { cursor: pointer; }
.cal-cell.cal-fixable:hover { border-color: var(--brand-400); box-shadow: var(--shadow-pop); }
.cal-day { font-size: 13px; font-weight: 600; color: var(--text-1); }
.cal-type { font-size: 11px; color: var(--text-2); margin-top: 2px; }
.cal-time { font-size: 10.5px; color: var(--text-3); font-variant-numeric: tabular-nums; margin-top: 3px; }
.cal-time.dim { color: var(--text-4); }
.cal-ot {
  position: absolute; top: 6px; right: 6px;
  font-size: 10px; color: var(--warning); background: var(--warning-bg);
  padding: 0 4px; border-radius: var(--r-sm);
}

.cnt { font-size: 12px; color: var(--text-3); }
.more { font-size: 12.5px; color: var(--brand-600); cursor: pointer; }
.more:hover { color: var(--brand-700); }

.md-tip { margin: 0 0 12px; font-size: 12.5px; color: var(--text-3); }
.ck-list {
  max-height: 320px; overflow: auto;
  border: 1px solid var(--border-subtle); border-radius: var(--r-md);
}
.ck-item {
  display: grid;
  grid-template-columns: 20px 96px 34px 62px 1fr;
  align-items: center; gap: 10px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: background-color var(--dur-base) var(--ease);
}
.ck-item:last-child { border-bottom: none; }
.ck-item:hover { background: var(--surface-hover); }
.ck-item.on { background: var(--brand-050); }
.ck-date { font-size: 12.5px; color: var(--text-1); }
.ck-week { font-size: 12px; color: var(--text-3); }
.ck-time { font-size: 12px; color: var(--text-2); text-align: right; }
.fix-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

@media (max-width: 1240px) { .at-grid { grid-template-columns: 1fr; } }
</style>
