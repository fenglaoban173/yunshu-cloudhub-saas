<script setup lang="ts">
/**
 * 凭证录入
 * ---------------------------------------------------------------------------
 * 页面上每个按钮 / 交互都是真实行为，没有占位提示：
 *  - 上一张 / 下一张：在凭证库（data.rows('voucher')）里真实导航，把目标凭证的日期、
 *    摘要、金额与分录整体填进表单；到头时提示「已经是第一张 / 最后一张」
 *  - 新建凭证：重置为一张空白待录入凭证，凭证号按库中最大号顺延
 *  - 保存草稿 / 提交审核：把当前表单写进全局仓库，状态分别为「草稿」「审批中」；
 *    保存后当前索引指向刚写入的那一条，重复点击不会产生重复记录
 *  - 联查：打开全局预览，列出该凭证关联的应收 / 应付 / 费用单；面板里单据号可点开详情
 *  - 由费用单生成凭证：走全站统一的「生成凭证」动作，打开凭证新增表单并预填金额与事由
 *  - 分录增删：实时重算借贷合计与差额，差额不为 0 时以警示色提示
 *
 * 金额口径：仓库（mock 初始数据）里凭证金额以「万元」存储，表单内以「元」录入，
 * 读写时统一换算，保证与既有凭证、统计口径一致。
 */
import { computed, ref } from 'vue'
import { message } from 'ant-design-vue'
import AppIcon from '@/components/AppIcon.vue'
import { finAccounts, voucherEntries } from '@/mock/finance'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import { useUserStore } from '@/stores/user'
import { useAction } from '@/composables/useAction'

interface Entry {
  id: number
  summary: string
  account: string
  dir: '借' | '贷'
  debit: number | null
  credit: number | null
  aux: string
}

/** 联查面板里的来源单据 */
interface LinkedDoc {
  id: string
  type: string
  party: string
  amount: number
  status: string
  pageKey: string
  raw: any
}

const data = useDataStore()
const ui = useUiStore()
const user = useUserStore()
const { run } = useAction()

/* ========================================================== 凭证库（导航来源） */
/** 凭证按凭证号升序；凭证号为空的历史记录排在最后 */
const voucherList = computed(() => {
  const list = [...(data.rows('voucher') as any[])]
  return list.sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
})
function sortKey(v: any) {
  const code = String(v.code ?? '').trim()
  return code || `记-${String(v.id ?? '')}`
}

/* ========================================================== 表单状态 */
const bookset = ref('云枢科技集团本部账套')
const period = ref('2025-10')
const voucherWord = ref('记')
const voucherNo = ref('0039')
const voucherDate = ref('2025-10-28')
const attachCount = ref(2)
/** 当前凭证在凭证库中的下标；-1 表示正在编制一张尚未保存的新凭证 */
const currentIndex = ref(-1)
const entries = ref<Entry[]>([])

/** 可选账套：取自账套管理（只给使用中的，停用账套不出现在凭证录入里） */
const booksetOptions = computed(() =>
  (data.rows('bookset') as any[])
    .filter((b) => b.status === '使用中')
    .map((b) => ({ label: b.name, value: b.name })),
)

const accounts = finAccounts.filter((a) => a.level === 2).map((a) => ({
  label: `${a.code} ${a.name}`,
  value: `${a.code} ${a.name}`,
}))

/* ========================================================== 合计与平衡 */
const debitTotal = computed(() => entries.value.reduce((s, e) => s + (e.debit || 0), 0))
const creditTotal = computed(() => entries.value.reduce((s, e) => s + (e.credit || 0), 0))
const diff = computed(() => +(debitTotal.value - creditTotal.value).toFixed(2))
const balanced = computed(() => Math.abs(diff.value) < 0.005)

const fmt = (v: number) =>
  v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function nowText() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/* ========================================================== 凭证初始化 */
function blankEntry(): Entry {
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    summary: '',
    account: '',
    dir: '借',
    debit: null,
    credit: null,
    aux: '',
  }
}
function toEntry(e: any): Entry {
  const d = Number(e.debit ?? 0)
  const c = Number(e.credit ?? 0)
  return {
    id: Number(e.id ?? Date.now()),
    summary: e.summary ?? '',
    account: e.account ?? '',
    dir: d > 0 ? '借' : '贷',
    debit: d || null,
    credit: c || null,
    aux: e.aux ?? '',
  }
}
/** 凭证号顺延：取库中最大号 +1 */
function nextVoucherNo() {
  let max = 0
  for (const v of voucherList.value) {
    const m = String(v.code ?? '').match(/(\d+)\s*$/)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return String(max + 1).padStart(4, '0')
}
/** 重置为一张待录入凭证；blank=false 时沿用演示分录 */
function resetDraft(blank = true) {
  currentIndex.value = -1
  voucherWord.value = '记'
  voucherNo.value = nextVoucherNo()
  voucherDate.value = '2025-10-28'
  attachCount.value = 2
  entries.value = blank ? [blankEntry()] : voucherEntries.map(toEntry)
}
resetDraft(false)

/* ========================================================== 凭证导航 */
const voucherCodeText = computed(() => `${voucherWord.value}-${voucherNo.value}`)
const currentVoucher = computed(() =>
  currentIndex.value >= 0 ? voucherList.value[currentIndex.value] : null,
)
const isDraft = computed(() => currentIndex.value < 0)
const positionText = computed(() =>
  isDraft.value
    ? `待录入 · 库中已有 ${voucherList.value.length} 张`
    : `第 ${currentIndex.value + 1} / ${voucherList.value.length} 张`,
)
const statusText = computed(() =>
  isDraft.value ? '待录入' : String(currentVoucher.value?.status ?? '草稿'),
)
const statusColor = computed(() => {
  const s = statusText.value
  if (s === '已审核' || s === '已记账') return 'success'
  if (s === '审批中' || s === '待审核') return 'processing'
  return 'default'
})

/** 按摘要选择一套标准分录方案，金额取凭证自身的借贷合计 */
function accountPlan(words: string): [('借' | '贷'), string][] {
  if (/销售|收款|退货|退款/.test(words)) return [['借', '1002 银行存款'], ['贷', '6001 主营业务收入']]
  if (/采购|付款|供应商|购货/.test(words)) return [['借', '2202 应付账款'], ['贷', '1002 银行存款']]
  if (/工资|薪酬|奖金/.test(words)) return [['借', '6602 管理费用'], ['贷', '2211 应付职工薪酬']]
  if (/社保|公积金/.test(words)) return [['借', '6602 管理费用'], ['贷', '2221 应交税费']]
  if (/差旅|报销|交通/.test(words)) return [['借', '6601 销售费用'], ['贷', '1002 银行存款']]
  if (/房租|租金|物业/.test(words)) return [['借', '6602 管理费用'], ['贷', '1002 银行存款']]
  if (/折旧/.test(words)) return [['借', '6602 管理费用'], ['贷', '1602 累计折旧']]
  if (/结转成本/.test(words)) return [['借', '6401 主营业务成本'], ['贷', '1405 库存商品']]
  return [['借', '6602 管理费用'], ['贷', '1002 银行存款']]
}
/** 还原一张凭证的分录：优先用已保存的分录，否则按摘要生成标准分录 */
function buildEntries(v: any): Entry[] {
  if (Array.isArray(v.entries) && v.entries.length) return v.entries.map(toEntry)
  const words = String(v.words ?? '')
  const debit = Number(v.debit ?? 0) * 10000
  const credit = Number(v.credit ?? 0) * 10000
  return accountPlan(words).map(([dir, account], i) => ({
    id: Date.now() + i,
    summary: words,
    account,
    dir,
    debit: dir === '借' ? debit : null,
    credit: dir === '贷' ? credit : null,
    aux: '',
  }))
}
/** 载入一张凭证到表单 */
function loadVoucher(v: any) {
  const idx = voucherList.value.findIndex((x) => x.id === v.id)
  currentIndex.value = idx
  const [word, no] = String(v.code ?? '').split('-')
  voucherWord.value = word || '记'
  voucherNo.value = no || String(idx + 1).padStart(4, '0')
  period.value = String(v.period ?? period.value)
  voucherDate.value = String(v.date ?? '2025-10-28')
  // 账套：历史凭证可能没有这个字段，回落到默认账套
  bookset.value = String(v.bookset ?? bookset.value)
  attachCount.value = Number(v.count ?? 0)
  entries.value = buildEntries(v)
}
function goPrev() {
  if (isDraft.value) {
    const last = voucherList.value.length - 1
    if (last < 0) {
      message.info('凭证库中还没有已保存的凭证')
      return
    }
    loadVoucher(voucherList.value[last])
    return
  }
  if (currentIndex.value <= 0) {
    message.info('已经是第一张凭证')
    return
  }
  loadVoucher(voucherList.value[currentIndex.value - 1])
}
function goNext() {
  if (isDraft.value) {
    message.info('已经是最后一张凭证')
    return
  }
  if (currentIndex.value >= voucherList.value.length - 1) {
    message.info('已经是最后一张凭证')
    return
  }
  loadVoucher(voucherList.value[currentIndex.value + 1])
}
function newVoucher() {
  resetDraft(true)
  message.info('已新建空白凭证，填写后保存草稿或提交审核')
}

/* ========================================================== 分录增删 */
function addRow() {
  entries.value.push(blankEntry())
}
function removeRow(id: number) {
  if (entries.value.length <= 1) {
    message.warning('至少保留一条会计分录')
    return
  }
  entries.value = entries.value.filter((e) => e.id !== id)
}
/** 切换借贷方向：另一侧金额清空，保证合计实时重算 */
function setDir(e: Entry, dir: '借' | '贷') {
  e.dir = dir
  if (dir === '借') e.credit = null
  else e.debit = null
}
function onDebitChange(e: Entry, v: number | null) {
  if ((v ?? 0) > 0) e.dir = '借'
}
function onCreditChange(e: Entry, v: number | null) {
  if ((v ?? 0) > 0) e.dir = '贷'
}

/* ========================================================== 保存与提交 */
function collectPayload(status: string) {
  return {
    code: voucherCodeText.value,
    period: period.value,
    date: voucherDate.value,
    bookset: bookset.value,
    words: entries.value[0]?.summary ?? '',
    source: '手工录入',
    debit: +(debitTotal.value / 10000).toFixed(2),
    credit: +(creditTotal.value / 10000).toFixed(2),
    count: entries.value.length,
    owner: user.user.name,
    status,
    entries: entries.value.map((e) => ({ ...e })),
  }
}
/** 保存前置校验：日期、摘要、至少一条完整分录、借贷平衡 */
function validate(): string {
  if (!voucherDate.value) return '请先填写凭证日期'
  if (!entries.value.length) return '至少需要一条会计分录'
  const filled = entries.value.filter(
    (e) => e.summary.trim() && e.account.trim() && ((e.debit || 0) > 0 || (e.credit || 0) > 0),
  )
  if (!filled.length) return '请至少填写一条完整分录（摘要、科目、金额）'
  if (!balanced.value) return `借贷不平衡，差额 ¥ ${fmt(diff.value)}，请调整后再保存`
  return ''
}
/** 写入仓库；已存在的凭证走更新，新建走新增，保存后索引指向该记录 */
function persist(status: string) {
  const payload = collectPayload(status)
  const target = currentVoucher.value
  const row = target
    ? data.updateRow('voucher', target.id, payload)
    : data.addRow('voucher', payload)
  const idx = voucherList.value.findIndex((v) => v.id === row.id)
  if (idx >= 0) currentIndex.value = idx
  return row
}
function saveDraft() {
  const err = validate()
  if (err) {
    message.warning(err)
    return
  }
  const row = persist('草稿')
  message.success(`凭证 ${row.code} 已保存为草稿`)
}
function submitAudit() {
  const err = validate()
  if (err) {
    message.warning(err)
    return
  }
  const row = persist('审批中')
  data.addRow('message', {
    title: `凭证待审核：${row.code} ${row.words}`,
    type: '审批提醒',
    from: user.user.name,
    priority: '重要',
    read: '未读',
    sendAt: nowText(),
  })
  message.success(`凭证 ${row.code} 已提交审核`)
}

/* ========================================================== 关联来源单据 */
const linkedDocs = computed<LinkedDoc[]>(() => {
  const toDoc = (pageKey: string, type: string, rows: any[], nameKey: string, amountKey: string): LinkedDoc[] =>
    rows.map((r) => ({
      id: String(r.id ?? ''),
      type,
      party: String(r[nameKey] ?? '—'),
      amount: Number(r[amountKey] ?? 0),
      status: String(r.status ?? '—'),
      pageKey,
      raw: r,
    }))
  const all = [
    ...toDoc('ar', '应收单', data.rows('ar') as any[], 'customer', 'total'),
    ...toDoc('ap', '应付单', data.rows('ap') as any[], 'supplier', 'total'),
    ...toDoc('expense', '费用报销单', data.rows('expense') as any[], 'title', 'amount'),
  ]
  // 与当前凭证辅助核算相关的单据优先展示
  const aux = String(entries.value[0]?.aux ?? '').trim()
  const score = (d: LinkedDoc) => (aux && (d.party.includes(aux) || aux.includes(d.party)) ? 1 : 0)
  return all
    .map((d) => ({ d, s: score(d) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 4)
    .map((x) => x.d)
})
/** 面板中的单据行可点开详情 */
function openLinkedDoc(d: LinkedDoc) {
  ui.openDetail(d.pageKey, d.raw)
}
/** 联查：打开全局预览，列出全部关联来源单据 */
function openLinkPreview() {
  const docs = linkedDocs.value
  if (!docs.length) {
    message.info('当前凭证暂无可联查的来源单据')
    return
  }
  ui.openPreview('关联来源单据', {
    title: '关联来源单据',
    subtitle: `${voucherCodeText.value} · ${entries.value[0]?.summary || '未填写摘要'} · 共 ${docs.length} 张`,
    sections: [
      {
        title: '来源单据',
        type: 'table',
        columns: [
          { key: 'id', title: '单据编号' },
          { key: 'type', title: '单据类型' },
          { key: 'party', title: '往来方' },
          { key: 'amount', title: '金额' },
          { key: 'status', title: '状态' },
        ],
        data: docs.map((d) => ({
          id: d.id,
          type: d.type,
          party: d.party,
          amount: `¥ ${fmt(d.amount)}`,
          status: d.status,
        })),
      },
    ],
  })
}
/** 由费用报销单生成凭证：走全站统一的「生成凭证」动作，打开凭证新增表单并预填 */
const linkedExpense = computed(() => linkedDocs.value.find((d) => d.pageKey === 'expense'))
function generateFromExpense() {
  const doc = linkedExpense.value
  if (!doc) {
    message.warning('关联单据里没有费用报销单，无法生成凭证')
    return
  }
  const amount = Number(doc.raw.amount ?? 0)
  run('生成凭证', {
    pageKey: 'expense',
    // 平台动作按「来源单 → 凭证」的字段对应关系预填，这里把来源单整理成凭证字段
    row: {
      ...doc.raw,
      code: `记-${nextVoucherNo()}`,
      period: period.value,
      date: doc.raw.applyDate ?? voucherDate.value,
      words: doc.raw.title ?? doc.party,
      source: '业务单据',
      debit: amount,
      credit: amount,
      count: 2,
      owner: user.user.name,
      status: '草稿',
    },
  })
}

/* ========================================================== 侧栏数据 */
const recentVouchers = computed(() => voucherList.value.slice(-6).reverse())
const sideStats = computed(() => {
  const list = voucherList.value
  const debit = list.reduce((s, v) => s + Number(v.debit || 0), 0)
  const credit = list.reduce((s, v) => s + Number(v.credit || 0), 0)
  const pending = list.filter((v) => ['待审核', '审批中'].includes(String(v.status))).length
  const manual = list.filter((v) => v.source === '手工录入').length
  return {
    count: list.length,
    debit,
    credit,
    pending,
    manualRate: list.length ? +((manual / list.length) * 100).toFixed(1) : 0,
  }
})
</script>

<template>
  <div class="page ve-page">
    <div class="ve-head">
      <div>
        <h1>凭证录入</h1>
        <p>记账凭证编制，自动校验借贷平衡，审核后生成总账</p>
      </div>
      <a-space>
        <a-button @click="goPrev">
          <template #icon><AppIcon name="UpOutlined" :size="13" /></template>
          上一张
        </a-button>
        <a-button @click="goNext">
          <template #icon><AppIcon name="DownOutlined" :size="13" /></template>
          下一张
        </a-button>
        <a-button @click="newVoucher">
          <template #icon><AppIcon name="PlusOutlined" :size="13" /></template>
          新建凭证
        </a-button>
        <a-button @click="saveDraft">保存草稿</a-button>
        <a-button type="primary" @click="submitAudit">提交审核</a-button>
      </a-space>
    </div>

    <div class="ve-grid">
      <div class="ve-main">
        <!-- 凭证头 -->
        <div class="card ve-header">
          <div class="vh-nav">
            <span class="vn-code num">{{ voucherCodeText }}</span>
            <a-tag :color="statusColor" :bordered="false">{{ statusText }}</a-tag>
            <span class="vn-pos">{{ positionText }}</span>
            <span class="vn-meta">凭证字 {{ voucherWord }} · 会计期间 {{ period }} · 制单人 {{ user.user.name }}</span>
          </div>
          <div class="vh-row">
            <div class="vh-field">
              <label>账套</label>
              <a-select v-model:value="bookset" :options="booksetOptions" />
            </div>
            <div class="vh-field">
              <label>会计期间</label>
              <a-select v-model:value="period" :options="['2025-10', '2025-09', '2025-08'].map(v => ({ label: v, value: v }))" />
            </div>
            <div class="vh-field">
              <label>凭证字</label>
              <a-select v-model:value="voucherWord" :options="['记', '收', '付', '转'].map(v => ({ label: v, value: v }))" />
            </div>
            <div class="vh-field">
              <label>凭证号</label>
              <a-input v-model:value="voucherNo" style="width: 90px" />
            </div>
            <div class="vh-field">
              <label>凭证日期</label>
              <a-date-picker v-model:value="voucherDate" value-format="YYYY-MM-DD" style="width: 140px" />
            </div>
            <div class="vh-field">
              <label>制单人</label>
              <a-input :value="user.user.name" disabled style="width: 92px" />
            </div>
            <div class="vh-field">
              <label>附件数</label>
              <a-input-number v-model:value="attachCount" :min="0" style="width: 78px" />
            </div>
          </div>
        </div>

        <!-- 分录 -->
        <div class="card ve-table-card">
          <div class="card-hd">
            <h3>会计分录</h3>
            <div class="vh-actions">
              <span class="bal" :class="balanced ? 'ok' : 'bad'">
                <AppIcon :name="balanced ? 'CheckCircleOutlined' : 'ExclamationCircleOutlined'" :size="13" />
                {{ balanced ? '借贷平衡' : '借贷不平' }}
              </span>
              <span v-if="!balanced" class="bal-diff num">差额 ¥ {{ fmt(diff) }}</span>
              <a-button size="small" @click="addRow">
                <template #icon><AppIcon name="PlusOutlined" :size="12" /></template>
                增加分录
              </a-button>
            </div>
          </div>

          <div class="ve-table-wrap">
            <table class="ve-table">
              <thead>
                <tr>
                  <th style="width: 42px">#</th>
                  <th style="width: 200px">摘要</th>
                  <th style="width: 230px">会计科目</th>
                  <th style="width: 84px">方向</th>
                  <th style="width: 150px" class="r">借方金额</th>
                  <th style="width: 150px" class="r">贷方金额</th>
                  <th>辅助核算</th>
                  <th style="width: 56px"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(e, i) in entries" :key="e.id">
                  <td class="idx">{{ i + 1 }}</td>
                  <td><a-input v-model:value="e.summary" size="small" placeholder="摘要" /></td>
                  <td>
                    <a-select
                      v-model:value="e.account"
                      :options="accounts"
                      size="small"
                      show-search
                      placeholder="选择科目"
                      style="width: 100%"
                    />
                  </td>
                  <td>
                    <a-select
                      :value="e.dir"
                      :options="[{ label: '借方', value: '借' }, { label: '贷方', value: '贷' }]"
                      size="small"
                      style="width: 100%"
                      @change="(v: '借' | '贷') => setDir(e, v)"
                    />
                  </td>
                  <td class="r">
                    <a-input-number
                      v-model:value="e.debit"
                      size="small"
                      :controls="false"
                      :min="0"
                      :precision="2"
                      :disabled="e.dir === '贷'"
                      placeholder="0.00"
                      style="width: 100%"
                      @change="(v: number | null) => onDebitChange(e, v)"
                    />
                  </td>
                  <td class="r">
                    <a-input-number
                      v-model:value="e.credit"
                      size="small"
                      :controls="false"
                      :min="0"
                      :precision="2"
                      :disabled="e.dir === '借'"
                      placeholder="0.00"
                      style="width: 100%"
                      @change="(v: number | null) => onCreditChange(e, v)"
                    />
                  </td>
                  <td><a-input v-model:value="e.aux" size="small" placeholder="客户 / 部门 / 银行" /></td>
                  <td>
                    <a class="rm" @click="removeRow(e.id)">
                      <AppIcon name="DeleteOutlined" :size="13" />
                    </a>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4" class="r sum-label">合计</td>
                  <td class="r sum num">¥ {{ fmt(debitTotal) }}</td>
                  <td class="r sum num">¥ {{ fmt(creditTotal) }}</td>
                  <td colspan="2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- 来源单据 -->
        <div class="card">
          <div class="card-hd">
            <h3>关联来源单据</h3>
            <a-space :size="4">
              <a-button size="small" type="text" @click="generateFromExpense">
                <template #icon><AppIcon name="FormOutlined" :size="12" /></template>
                由费用单生成凭证
              </a-button>
              <a-button size="small" type="text" @click="openLinkPreview">联查</a-button>
            </a-space>
          </div>
          <div class="card-bd" style="padding: 0">
            <a-table :data-source="linkedDocs" :pagination="false" size="small" row-key="id">
              <a-table-column key="id" title="单据编号" data-index="id" width="160">
                <template #default="{ record }">
                  <a class="lk" @click="openLinkedDoc(record)">{{ record.id }}</a>
                </template>
              </a-table-column>
              <a-table-column key="type" title="单据类型" data-index="type" width="120" />
              <a-table-column key="party" title="往来方" data-index="party" />
              <a-table-column key="amount" title="金额" data-index="amount" align="right" width="130">
                <template #default="{ record }">¥ {{ fmt(record.amount) }}</template>
              </a-table-column>
              <a-table-column key="status" title="状态" data-index="status" width="130">
                <template #default="{ record }">
                  <a-tag :color="record.status === '已生成凭证' ? 'success' : 'default'" :bordered="false">{{ record.status }}</a-tag>
                </template>
              </a-table-column>
              <a-table-column key="op" title="操作" width="80">
                <template #default="{ record }">
                  <a class="lk" @click="openLinkedDoc(record)">查看</a>
                </template>
              </a-table-column>
            </a-table>
          </div>
        </div>
      </div>

      <!-- 右栏 -->
      <div class="ve-side">
        <div class="card">
          <div class="card-hd"><h3>最近凭证</h3><span class="cnt">共 {{ voucherList.length }} 张</span></div>
          <div class="card-bd" style="padding: 6px 0">
            <div
              v-for="v in recentVouchers"
              :key="v.id"
              class="rc"
              :class="{ on: currentVoucher && currentVoucher.id === v.id }"
              @click="loadVoucher(v)"
            >
              <div class="rc-main">
                <div class="rc-code">{{ v.code }}</div>
                <div class="rc-words">{{ v.words }} · {{ v.date }}</div>
              </div>
              <div class="rc-right">
                <div class="rc-amt num">¥ {{ fmt(Number(v.debit || 0)) }} 万</div>
                <a-tag :color="v.status === '已审核' ? 'processing' : 'success'" :bordered="false">{{ v.status }}</a-tag>
              </div>
            </div>
            <a-empty v-if="!recentVouchers.length" description="暂无凭证" style="padding: 26px 0" />
          </div>
        </div>

        <div class="card">
          <div class="card-hd"><h3>本期发生额</h3></div>
          <div class="card-bd side-stats">
            <div class="ss"><span>凭证数</span><b class="num">{{ sideStats.count }}</b></div>
            <div class="ss"><span>借方合计</span><b class="num">¥ {{ fmt(sideStats.debit) }} 万</b></div>
            <div class="ss"><span>贷方合计</span><b class="num">¥ {{ fmt(sideStats.credit) }} 万</b></div>
            <div class="ss"><span>待审核</span><b class="num warn">{{ sideStats.pending }}</b></div>
            <div class="ss"><span>手工录入占比</span><b class="num">{{ sideStats.manualRate }}%</b></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ve-page { display: flex; flex-direction: column; gap: 12px; }
.ve-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.ve-head h1 { margin: 0 0 5px; font-size: 20px; font-weight: 600; }
.ve-head p { margin: 0; font-size: 13px; color: var(--text-3); }
.cnt { font-size: 12px; color: var(--text-3); }

.ve-grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 12px; align-items: start; }
.ve-main { display: flex; flex-direction: column; gap: 12px; }

/* 凭证头 */
.ve-header { padding: 14px 18px; }
.vh-nav {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding-bottom: 12px; margin-bottom: 12px; border-bottom: 1px solid var(--border-subtle);
}
.vn-code { font-size: 15px; font-weight: 600; color: var(--text-1); }
.vn-pos { font-size: 12.5px; color: var(--text-2); }
.vn-meta { margin-left: auto; font-size: 12px; color: var(--text-3); }
.vh-row { display: flex; gap: 20px; flex-wrap: wrap; }
.vh-field { display: flex; flex-direction: column; gap: 5px; }
.vh-field label { font-size: 12px; color: var(--text-3); }
.vh-field :deep(.ant-select) { width: 190px; }

/* 分录表 */
.ve-table-card { overflow: hidden; }
.vh-actions { display: flex; align-items: center; gap: 12px; }
.bal { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; }
.bal.ok { color: var(--success); }
.bal.bad { color: var(--danger); }
.bal-diff { font-size: 12.5px; color: var(--danger); }
.ve-table-wrap { overflow-x: auto; }
.ve-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.ve-table th {
  background: var(--surface-sunken); text-align: left; font-weight: 500;
  color: var(--text-2); padding: 9px 10px; font-size: 12.5px;
  border-bottom: 1px solid var(--border); white-space: nowrap;
}
.ve-table td { padding: 5px 10px; border-bottom: 1px solid var(--border-subtle); vertical-align: middle; }
.ve-table tbody tr:hover td { background: var(--surface-hover); }
.ve-table .r { text-align: right; }
.ve-table .idx { color: var(--text-4); text-align: center; font-variant-numeric: tabular-nums; }
.ve-table tfoot td {
  background: var(--surface-sunken); font-weight: 600; border-top: 1px solid var(--border);
  border-bottom: none; padding: 11px 10px;
}
.sum-label { color: var(--text-2); font-weight: 500; }
.sum { color: var(--brand-600); }
.rm { color: var(--text-4); cursor: pointer; }
.rm:hover { color: var(--danger); }
.lk { color: var(--brand-600); cursor: pointer; }
.lk:hover { color: var(--brand-700); text-decoration: underline; }

/* 侧栏 */
.ve-side { display: flex; flex-direction: column; gap: 12px; }
.rc {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 10px 18px; cursor: pointer;
  transition: background-color var(--dur-base) var(--ease);
}
.rc:hover { background: var(--surface-hover); }
.rc.on { background: var(--brand-050); }
.rc-main { min-width: 0; }
.rc-code { font-size: 13px; font-weight: 500; color: var(--text-1); font-variant-numeric: tabular-nums; }
.rc-words { font-size: 11.5px; color: var(--text-3); margin-top: 2px; }
.rc-right { text-align: right; flex: none; }
.rc-amt { font-size: 13px; font-weight: 600; margin-bottom: 3px; }
.side-stats { display: flex; flex-direction: column; gap: 12px; }
.ss { display: flex; align-items: center; justify-content: space-between; }
.ss span { font-size: 12.5px; color: var(--text-3); }
.ss b { font-size: 14px; font-weight: 600; }
.ss b.warn { color: var(--warning); }

@media (max-width: 1240px) { .ve-grid { grid-template-columns: 1fr; } }
</style>
