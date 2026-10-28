<script setup lang="ts">
/**
 * 配置驱动的通用列表页
 * ---------------------------------------------------------------------------
 * 由 `mock/pages.ts` 的 PageDef 驱动，渲染 ~45 个功能页面。页面上的每一个按钮
 * 都不写死逻辑，而是交给 `composables/useAction.ts` 按动作语义统一执行：
 * 新建 / 编辑走全局表单抽屉，审批 / 删除走确认 + 真实改数据，导出走真实 CSV 下载。
 * 列表数据来自 `stores/data.ts`，新增、审批、删除后表格立即更新。
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { pages } from '@/mock/pages'
import type { ColumnDef, StatDef } from '@/config/types'
import AppIcon from '@/components/AppIcon.vue'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import { useUserStore } from '@/stores/user'
import { useChromeStore } from '@/stores/chrome'
import { useAction } from '@/composables/useAction'
import { isDanger } from '@/config/actionRules'

const route = useRoute()
const router = useRouter()
const data = useDataStore()
const ui = useUiStore()
const user = useUserStore()
const chrome = useChromeStore()
const { run } = useAction()

const pageKey = computed(() => String(route.meta.pageKey ?? ''))
const def = computed(() => pages[pageKey.value])
/** 行操作按钮（行内链接） */
const rowActions = computed<string[]>(() => def.value?.rowActions ?? [])
/** 工具栏动作：页面级动作，不依赖勾选 */
const toolbarActions = computed<string[]>(() => def.value?.toolbar ?? [])
/** 批量动作：勾选了行才出现在工具栏上 */
const batchActions = computed<string[]>(() => def.value?.batchActions ?? [])
/** 是否处于「批量选择」状态 —— 工具栏据此在普通模式与批量模式之间切换 */
const batchMode = computed(() => selectedKeys.value.length > 0)

/* ---------------- 交互状态 ---------------- */
const searchModel = ref<Record<string, any>>({})
const expanded = ref(false)
const activeTab = ref('')
const pageNum = ref(1)
const pageSize = ref(10)
const selectedKeys = ref<any[]>([])
const refreshing = ref(false)
/** 当前排序列与方向（'' 表示不排序） */
const sortField = ref('')
const sortOrder = ref<'ascend' | 'descend' | ''>('')
/** 最近一次刷新的时间（页脚可见，让「刷新」是可观察的行为） */
const lastRefreshedAt = ref('')

/**
 * 表格密度只有一个来源：全局偏好（`stores/chrome`）。
 * 偏好里的「紧凑 / 默认 / 宽松」与工具栏的密度按钮是同一个设置，
 * 工具栏切换后写回偏好，刷新页面仍然保留。
 */
const density = computed<'small' | 'middle' | 'large'>(() =>
  chrome.prefs.density === 'compact' ? 'small' : chrome.prefs.density === 'relaxed' ? 'large' : 'middle',
)
/** 密度按钮的三档循环顺序 */
const densityOrder = ['compact', 'default', 'relaxed'] as const
const densityLabel = computed(
  () => ({ compact: '紧凑', default: '默认', relaxed: '宽松' })[chrome.prefs.density],
)
function cycleDensity() {
  const i = densityOrder.indexOf(chrome.prefs.density)
  chrome.setDensity(densityOrder[(i + 1) % densityOrder.length])
}

/* ---------------- 深链筛选 ---------------- */
/**
 * 地址栏里的查询条件直接落到搜索框上。
 * 图表下钻（「点失败的那一段 → 跳登录日志并只看失败」）靠它把点中的那一项带过去；
 * 不接上的话，跳过去还是一屏全量，等于没下钻。
 */
const linkFilters = ref<{ key: string; label: string; value: string }[]>([])

function applyQueryFilter() {
  const q = route.query as Record<string, any>
  const model: Record<string, any> = {}
  const applied: { key: string; label: string; value: string }[] = []
  for (const f of def.value?.search ?? []) {
    // 区间选择器要的是 dayjs 对象，字符串塞进去会坏掉，这里只接输入框与下拉
    if (f.type === 'daterange') continue
    const raw = q[f.key]
    if (raw === undefined || raw === null || raw === '') continue
    const v = Array.isArray(raw) ? raw[0] : raw
    const text = String(v)
    // 下拉项只认选项里的值：地址栏写错时不至于把整个列表筛成空
    if (f.type === 'select' && f.options?.length && !f.options.some((o: any) => String(o.value) === text)) continue
    model[f.key] = v
    applied.push({ key: f.key, label: f.label, value: text })
  }
  searchModel.value = model
  linkFilters.value = applied
  pageNum.value = 1
  // 页签与筛选条件是「与」的关系：带着链接条件进来时，页签要放宽到「全部」，
  // 否则「待我审批 × 状态=已通过」会筛出 0 条，等于白跳一趟
  if (applied.length && (def.value?.tabs ?? []).includes('全部')) {
    activeTab.value = '全部'
  }
}

/** 去掉某个链接筛选条件（同时改地址栏，避免下次进来又被套上） */
function clearLinkFilter(key: string) {
  const q = { ...route.query }
  delete q[key]
  router.replace({ path: route.path, query: q })
}

/** 全部清掉：地址栏里的筛选参数一并去掉 */
function clearLinkFilters() {
  router.replace({ path: route.path, query: {} })
}

watch(
  pageKey,
  () => {
    searchModel.value = {}
    activeTab.value = def.value?.tabs?.[0] ?? ''
    pageNum.value = 1
    selectedKeys.value = []
    sortField.value = ''
    sortOrder.value = ''
    applyQueryFilter()
  },
  { immediate: true },
)

// 同一个页面换查询条件（例如从别处点「查看失败日志」跳过来）也要重新套用
watch(() => route.query, () => applyQueryFilter())

/* ---------------- 页签过滤 ---------------- */
/** 页签名与记录的匹配规则：状态字典命中 → 语义特判 → 文本相等 */
function tabMatches(tab: string, row: any): boolean {
  if (!tab || tab === '全部') return true
  const d = def.value
  if (!d) return true
  for (const c of d.columns) {
    if (c.statusMap && tab in c.statusMap) return String(row[c.key]) === tab
  }
  if (tab === '待我审批') return row.status === '审批中'
  if (tab === '我发起的') return row.applicant === user.user.name
  if (tab === '我已审批') return row.status === '已通过'
  if (tab === '待认证') return row.status !== '已审核'
  if (tab === '销项发票') return row.direction === '销项'
  if (tab === '进项发票') return row.direction === '进项'
  return Object.values(row).some((v) => String(v) === tab)
}

function tabCount(tab: string) {
  const d = def.value
  if (!d) return 0
  return data.rows(pageKey.value).filter((r: any) => tabMatches(tab, r)).length
}

/* ---------------- 排序 ---------------- */
/** 取数值：空值一律视为 NaN，排序时沉底 */
function numOf(v: any): number {
  if (v === '' || v === null || v === undefined) return NaN
  const n = Number(v)
  return Number.isNaN(n) ? NaN : n
}

/** 列比较器：金额 / 数值 / 进度按数字比，其余按文本比（日期字符串天然可比） */
function columnSorter(c: ColumnDef) {
  return (a: any, b: any) => {
    const av = a?.[c.key]
    const bv = b?.[c.key]
    if (c.type === 'money' || c.type === 'number' || c.type === 'progress') {
      const an = numOf(av)
      const bn = numOf(bv)
      if (Number.isNaN(an) && Number.isNaN(bn)) return 0
      if (Number.isNaN(an)) return 1
      if (Number.isNaN(bn)) return -1
      return an - bn
    }
    return String(av ?? '').localeCompare(String(bv ?? ''), 'zh-CN')
  }
}

/** 按当前排序列排序（分页前排序，否则只排当前页没有意义） */
function sortRows(rows: any[]) {
  if (!sortField.value || !sortOrder.value) return rows
  const c = def.value?.columns.find((x) => x.key === sortField.value)
  if (!c) return rows
  const cmp = columnSorter(c)
  const dir = sortOrder.value === 'descend' ? -1 : 1
  return [...rows].sort((a, b) => {
    const r = cmp(a, b)
    return r === 0 ? 0 : r * dir
  })
}

/* ---------------- 数据过滤 ---------------- */
/**
 * 行唯一键。所有数据集都有 id 或 code（总账明细已补 id），
 * 勾选状态与行数据必须用同一把钥匙，否则批量动作找不到选中的行。
 */
function rowKeyOf(r: any): string {
  return String(r?.id ?? r?.code ?? '')
}

const filtered = computed(() => {
  const d = def.value
  if (!d) return []
  let rows = [...data.rows(pageKey.value)]
  if (activeTab.value) rows = rows.filter((r) => tabMatches(activeTab.value, r))
  const m = searchModel.value
  for (const f of d.search ?? []) {
    const v = m[f.key]
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue
    if (f.type === 'select') {
      rows = rows.filter((r) => String(r[f.key]) === String(v))
    } else if (f.type === 'daterange') {
      const [s, e] = v
      if (s) rows = rows.filter((r) => String(r[f.key]).slice(0, 10) >= s)
      if (e) rows = rows.filter((r) => String(r[f.key]).slice(0, 10) <= e)
    } else {
      // 「关键词」搜整行；具名字段（负责人 / 申请人 / 客户…）只搜自己那一列，
      // 否则在「负责人」里输「陈墨」，客户名里带「陈墨」的记录也会被捞出来
      const kw = String(v).toLowerCase()
      rows = rows.filter((r) =>
        f.key === 'keyword'
          ? JSON.stringify(r).toLowerCase().includes(kw)
          : String(r[f.key] ?? '').toLowerCase().includes(kw),
      )
    }
  }
  return sortRows(rows)
})

const paged = computed(() => {
  const start = (pageNum.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value).map((r, i) => ({
    ...r,
    __key: rowKeyOf(r) || `${start + i}`,
  }))
})

/* ---------------- 格式化 ---------------- */
function fmtMoney(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === '') return '—'
  return Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtNumber(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === '') return '—'
  return Number(v).toLocaleString('zh-CN')
}
function tagColor(col: ColumnDef, value: string) {
  const m = col.statusMap?.[value]
  if (!m) return 'default'
  return m.color
}
function tagText(col: ColumnDef, value: string) {
  return col.statusMap?.[value]?.text ?? value
}

const visibleSearch = computed(() => {
  const s = def.value?.search ?? []
  return expanded.value ? s : s.slice(0, 3)
})

function resetSearch() {
  searchModel.value = {}
  pageNum.value = 1
}

function onSearch() {
  pageNum.value = 1
  message.success(`查询完成，共 ${filtered.value.length} 条记录`)
}

/** 刷新：重新按当前条件取数，并短暂显示 loading */
function onRefresh() {
  refreshing.value = true
  setTimeout(() => {
    refreshing.value = false
    // 重新取数：回到第一页、清掉勾选、按当前条件重新统计
    pageNum.value = 1
    selectedKeys.value = []
    lastRefreshedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    message.success(`数据已刷新 · 共 ${filtered.value.length} 条`)
  }, 420)
}

function openDetail(row: any) {
  ui.openDetail(pageKey.value, row)
}

/** 统一动作入口 */
function onAction(name: string, row?: any) {
  run(name, {
    pageKey: pageKey.value,
    row,
    selected: selectedRows.value,
    allRows: filtered.value,
  })
}

/** 「更多」下拉里的页面级动作 */
function onMoreAction(info: { key: string | number }) {
  onAction(String(info.key))
}

/** 当前勾选的完整记录 */
const selectedRows = computed(() =>
  filtered.value.filter((r: any) => selectedKeys.value.includes(rowKeyOf(r))),
)

// 行被删掉（批量删除）后，勾选里不能留下幽灵计数 —— 结果集一变就重新对一遍
watch(filtered, (rows) => {
  if (!selectedKeys.value.length) return
  const alive = new Set(rows.map((r: any) => rowKeyOf(r)))
  selectedKeys.value = selectedKeys.value.filter((k: any) => alive.has(k))
})

const visibleStats = computed<StatDef[]>(() => def.value?.stats ?? [])

function statTrendClass(v?: number) {
  if (v === undefined) return ''
  return v >= 0 ? 'up' : 'down'
}

/* ---------------- 表格列 ---------------- */
const tableColumns = computed(() => {
  const d = def.value
  if (!d) return []
  const cols: any[] = d.columns.map((c) => ({
    key: c.key,
    dataIndex: c.key,
    title: c.title,
    width: c.width,
    minWidth: c.minWidth,
    fixed: c.fixed,
    ellipsis: c.ellipsis,
    align: c.align ?? (c.type === 'money' || c.type === 'number' ? 'right' : 'left'),
    type: c.type,
    statusMap: c.statusMap,
    suffix: c.suffix,
    // 表头可点排序：升序 → 降序 → 取消
    sorter: columnSorter(c),
    sortOrder: sortField.value === c.key ? sortOrder.value : null,
  }))
  if (d.rowActions?.length) {
    cols.push({
      key: '__action',
      title: '操作',
      fixed: 'right',
      width: 60 + d.rowActions.length * 62,
      align: 'left',
      type: 'action',
    })
  }
  return cols
})

/**
 * 勾选列：所有列表页都支持批量动作（PageDef.batchActions），
 * 勾选后工具栏切换成批量模式。
 */
const rowSelection = computed(() => ({
  selectedRowKeys: selectedKeys.value,
  onChange: (keys: any[]) => (selectedKeys.value = keys),
  columnWidth: 44,
}))

function onTableChange(pag: any, _filters?: any, sorter?: any) {
  if (pag?.current) pageNum.value = pag.current
  if (pag?.pageSize) pageSize.value = pag.pageSize
  // 排序：升序 → 降序 → 取消（第三次点击 order 为空）
  const s = Array.isArray(sorter) ? sorter[0] : sorter
  const field = s?.field ?? s?.columnKey ?? ''
  if (s?.order && field) {
    sortField.value = String(field)
    sortOrder.value = s.order
  } else if (sortField.value) {
    sortField.value = ''
    sortOrder.value = ''
  }
  if (s?.order) pageNum.value = 1
}
</script>

<template>
  <div v-if="def" class="page list-page">
    <!-- ============ 页头 ============ -->
    <div class="lp-head">
      <div class="lp-head-main">
        <h1>{{ def.title }}</h1>
        <p v-if="def.desc">{{ def.desc }}</p>
      </div>
      <div class="lp-head-extra">
        <slot name="extra" />
        <a-button v-if="def.primaryAction" type="primary" @click="onAction(def.primaryAction)">
          <template #icon><AppIcon name="PlusOutlined" :size="14" /></template>
          {{ def.primaryAction }}
        </a-button>
      </div>
    </div>

    <!-- ============ Tabs ============ -->
    <a-tabs
      v-if="def.tabs?.length"
      v-model:activeKey="activeTab"
      class="lp-tabs"
      size="small"
      @change="pageNum = 1"
    >
      <a-tab-pane v-for="t in def.tabs" :key="t">
        <template #tab>
          <span class="lp-tab">
            {{ t }}
            <span class="lp-tab-cnt">{{ tabCount(t) }}</span>
          </span>
        </template>
      </a-tab-pane>
    </a-tabs>

    <!-- ============ 指标卡 ============ -->
    <div v-if="visibleStats.length" class="stat-grid">
      <div v-for="s in visibleStats" :key="s.label" class="stat-card">
        <div class="stat-ico" :class="s.tone || 'brand'">
          <AppIcon :name="s.icon || 'ThunderboltOutlined'" :size="17" />
        </div>
        <div class="stat-body">
          <div class="stat-label">{{ s.label }}</div>
          <div class="stat-value">
            {{ s.value }}
            <span v-if="s.unit" class="stat-unit">{{ s.unit }}</span>
            <span v-if="s.trend !== undefined" class="stat-trend" :class="statTrendClass(s.trend)">
              <AppIcon :name="s.trend >= 0 ? 'RiseOutlined' : 'FallOutlined'" :size="11" />
              {{ Math.abs(s.trend) }}%
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ============ 筛选 + 表格 ============ -->
    <div class="card table-card">
      <div class="search-zone">
        <!-- 深链筛选：条件来自地址栏（图表下钻带过来的），看得见、可单独清除 -->
        <div v-if="linkFilters.length" class="lp-link">
          <AppIcon name="LinkOutlined" :size="13" />
          <span class="lp-link-label">链接筛选</span>
          <a-tag
            v-for="f in linkFilters"
            :key="f.key"
            color="processing"
            :bordered="false"
            closable
            @close="clearLinkFilter(f.key)"
          >
            {{ f.label }} = {{ f.value }}
          </a-tag>
          <a-button type="link" size="small" @click="clearLinkFilters">清除全部</a-button>
        </div>
        <a-form layout="inline" class="search-form">
          <a-form-item v-for="f in visibleSearch" :key="f.key" :label="f.label">
            <a-select
              v-if="f.type === 'select'"
              v-model:value="searchModel[f.key]"
              :options="f.options"
              allow-clear
              placeholder="全部"
              style="width: 168px"
            />
            <a-range-picker
              v-else-if="f.type === 'daterange'"
              v-model:value="searchModel[f.key]"
              style="width: 240px"
            />
            <a-input
              v-else
              v-model:value="searchModel[f.key]"
              placeholder="请输入"
              allow-clear
              style="width: 190px"
            >
              <template #prefix><AppIcon name="SearchOutlined" :size="13" /></template>
            </a-input>
          </a-form-item>
          <a-form-item>
            <a-space :size="8">
              <a-button type="primary" @click="onSearch">
                <template #icon><AppIcon name="SearchOutlined" :size="13" /></template>
                查询
              </a-button>
              <a-button @click="resetSearch">重置</a-button>
              <a-button v-if="(def.search?.length ?? 0) > 3" type="link" @click="expanded = !expanded">
                {{ expanded ? '收起' : '展开' }}
                <AppIcon :name="expanded ? 'UpOutlined' : 'DownOutlined'" :size="11" />
              </a-button>
            </a-space>
          </a-form-item>
        </a-form>
      </div>

      <div class="table-zone">
        <div class="table-toolbar">
          <div class="tb-left">
            <!--
              工具栏切换模式（AntD Pro 惯例）：
              未勾选 → 页面级动作；勾选后 → 同一行切换成「已选 N 项 + 批量动作 + 取消选择」，
              不额外占一行，批量动作只有勾选了行才出现。
              页面级动作收进「更多」下拉，勾选期间也点得到。
            -->
            <template v-if="!batchMode">
              <a-button v-for="a in toolbarActions" :key="a" size="small" @click="onAction(a)">
                {{ a }}
              </a-button>
            </template>
            <template v-else>
              <span class="tb-selected">
                已选 <b>{{ selectedKeys.length }}</b> 项
              </span>
              <a-button v-for="a in batchActions" :key="a" size="small" @click="onAction(a)">
                {{ a }}
              </a-button>
              <a-button size="small" type="link" @click="selectedKeys = []">取消选择</a-button>
              <a-dropdown v-if="toolbarActions.length" placement="bottomLeft" :trigger="['click']">
                <a-button size="small">
                  更多
                  <AppIcon name="DownOutlined" :size="11" />
                </a-button>
                <template #overlay>
                  <a-menu @click="onMoreAction">
                    <a-menu-item v-for="a in toolbarActions" :key="a">{{ a }}</a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </template>
          </div>
          <div class="tb-right">
            <a-tooltip :title="`密度：${densityLabel}`">
              <a-button size="small" type="text" @click="cycleDensity">
                <AppIcon name="ControlOutlined" :size="14" />
              </a-button>
            </a-tooltip>
            <a-tooltip title="刷新">
              <a-button size="small" type="text" :loading="refreshing" @click="onRefresh">
                <AppIcon name="SyncOutlined" :size="14" />
              </a-button>
            </a-tooltip>
            <a-button size="small" @click="onAction('导出')">
              <template #icon><AppIcon name="DownloadOutlined" :size="13" /></template>
              导出
            </a-button>
          </div>
        </div>

        <a-table
          :data-source="paged"
          :columns="tableColumns"
          :pagination="false"
          :size="density"
          :row-selection="rowSelection"
          :scroll="{ x: 'max-content' }"
          :row-key="(r: any) => r.__key"
          @change="onTableChange"
        >
          <template #bodyCell="{ column, record }">
            <!-- 操作列 -->
            <template v-if="column.type === 'action'">
              <a
                v-for="(a, ai) in rowActions"
                :key="a"
                class="act-link"
                :class="{ danger: isDanger(a) }"
                @click="onAction(a, record)"
              >
                {{ a }}
              </a>
            </template>

            <!-- 金额 -->
            <template v-else-if="column.type === 'money'">
              <span class="cell-money">¥ {{ fmtMoney(record[column.dataIndex]) }}</span>
            </template>

            <!-- 数字 -->
            <template v-else-if="column.type === 'number'">
              <span class="cell-num">{{ fmtNumber(record[column.dataIndex]) }}{{ column.suffix ?? '' }}</span>
            </template>

            <!-- 标签 -->
            <template v-else-if="column.type === 'tag'">
              <a-tag :color="tagColor(column, record[column.dataIndex])" :bordered="false">
                {{ tagText(column, record[column.dataIndex]) }}
              </a-tag>
            </template>

            <!-- 进度 -->
            <template v-else-if="column.type === 'progress'">
              <a-progress
                :percent="Number(record[column.dataIndex]) || 0"
                size="small"
                :stroke-color="(record[column.dataIndex] as number) >= 100 ? '#00B42A' : '#165DFF'"
                :show-info="true"
              />
            </template>

            <!-- 首列可点 -->
            <template v-else-if="column.fixed === 'left' && column.key === def.columns[0]?.key">
              <a class="cell-link" @click="openDetail(record)">{{ record[column.dataIndex] }}</a>
            </template>

            <template v-else>
              {{ record[column.dataIndex] ?? '—' }}
            </template>
          </template>

          <template #emptyText>
            <a-empty description="暂无符合条件的数据" style="padding: 40px 0">
              <a-button size="small" @click="resetSearch">重置筛选条件</a-button>
            </a-empty>
          </template>
        </a-table>

        <div class="table-foot">
          <span class="tf-total">
            共 <b>{{ filtered.length }}</b> 条记录 · 当前第 {{ pageNum }} / {{ Math.max(1, Math.ceil(filtered.length / pageSize)) }} 页
            <template v-if="lastRefreshedAt">· 更新于 {{ lastRefreshedAt }}</template>
          </span>
          <a-pagination
            v-model:current="pageNum"
            v-model:page-size="pageSize"
            :total="filtered.length"
            :page-size-options="['10', '20', '50', '100']"
            size="small"
            show-size-changer
            show-less-items
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default { name: 'ListPage' }
</script>

<style scoped>
.list-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ---------- 页头 ---------- */
.lp-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}
.lp-head-main h1 {
  margin: 0 0 5px;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: var(--text-1);
}
.lp-head-main p {
  margin: 0;
  font-size: 13px;
  color: var(--text-3);
}
.lp-head-extra {
  display: flex;
  gap: 8px;
  flex: none;
}
.lp-tabs {
  margin-bottom: -8px;
}
.lp-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.lp-tab-cnt {
  font-size: 11px;
  color: var(--text-3);
  background: var(--surface-hover);
  border-radius: 8px;
  padding: 0 6px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
}

/* ---------- 指标卡 ---------- */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(216px, 1fr));
  gap: 12px;
}
.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 15px 16px;
  box-shadow: var(--shadow-card);
  transition: box-shadow var(--dur-base) var(--ease), border-color var(--dur-base) var(--ease);
}
.stat-card:hover {
  border-color: var(--brand-100);
  box-shadow: 0 2px 10px rgba(22, 93, 255, 0.07);
}
.stat-ico {
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: var(--r-md);
  display: flex;
  align-items: center;
  justify-content: center;
}
.stat-ico.brand {
  background: var(--brand-050);
  color: var(--brand-600);
}
.stat-ico.success {
  background: var(--success-bg);
  color: var(--success);
}
.stat-ico.warning {
  background: var(--warning-bg);
  color: var(--warning);
}
.stat-ico.danger {
  background: var(--danger-bg);
  color: var(--danger);
}
.stat-body {
  min-width: 0;
}
.stat-label {
  font-size: 12.5px;
  color: var(--text-3);
  margin-bottom: 3px;
}
.stat-value {
  font-size: 21px;
  font-weight: 600;
  color: var(--text-1);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  display: flex;
  align-items: baseline;
  gap: 5px;
}
.stat-unit {
  font-size: 12px;
  color: var(--text-3);
  font-weight: 400;
}
.stat-trend {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 11.5px;
  font-weight: 500;
  padding: 1px 5px;
  border-radius: var(--r-sm);
}
.stat-trend.up {
  color: var(--danger);
  background: var(--danger-bg);
}
.stat-trend.down {
  color: var(--success);
  background: var(--success-bg);
}

/* ---------- 表格卡片 ---------- */
.table-card {
  overflow: hidden;
}
.search-zone {
  padding: 16px 18px 4px;
  border-bottom: 1px solid var(--border-subtle);
}
.lp-link {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding-bottom: 10px;
  font-size: 12.5px;
  color: var(--text-3);
}
.lp-link-label {
  color: var(--text-2);
}
.search-form {
  row-gap: 12px;
}
.search-form :deep(.ant-form-item) {
  margin-bottom: 12px;
}

.table-zone {
  padding: 0 18px 14px;
}
.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  flex-wrap: wrap;
}
.tb-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.tb-right {
  display: flex;
  align-items: center;
  gap: 6px;
}
.tb-selected {
  font-size: 13px;
  color: var(--text-2);
  margin-right: 4px;
}
.tb-selected b {
  color: var(--brand-600);
}

/* ---------- 表格 ---------- */
.table-zone :deep(.ant-table-thead > tr > th) {
  font-weight: 500;
  font-size: 13px;
  color: var(--text-2);
  white-space: nowrap;
}
.table-zone :deep(.ant-table-tbody > tr > td) {
  font-size: 13px;
  color: var(--text-1);
}
.table-zone :deep(.ant-table-tbody > tr) > td:first-child {
  font-variant-numeric: tabular-nums;
}
.cell-money {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}
.cell-num {
  font-variant-numeric: tabular-nums;
}
.cell-link {
  color: var(--brand-600);
  cursor: pointer;
}
.cell-link:hover {
  text-decoration: underline;
}
.act-link {
  color: var(--brand-600);
  cursor: pointer;
  font-size: 12.5px;
  margin-right: 10px;
  white-space: nowrap;
}
.act-link:hover {
  color: var(--brand-700);
}
.act-link.danger {
  color: var(--danger);
}

.table-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 12px;
  flex-wrap: wrap;
}
.tf-total {
  font-size: 12.5px;
  color: var(--text-3);
}
.tf-total b {
  color: var(--text-1);
  font-variant-numeric: tabular-nums;
}
</style>
