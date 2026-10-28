<script setup lang="ts">
/**
 * CRM 客户 360 视图
 * ---------------------------------------------------------------------------
 * 页面上展示的客户 / 商机 / 合同 / 应收 / 回款 / 联系人 / 跟进全部来自
 * `stores/data.ts`，别处新增或修改后本页立即同步。
 *
 * 交互：
 *   - 顶部客户切换器：切换客户后所有页签重新计算
 *   - 客户简报：生成结构化预览（基本信息 / 商机漏斗 / 回款情况 / 跟进时间轴）
 *   - 新建跟进 / 新建合同：打开全局表单并预填当前客户
 *   - 各页签表格行可直接打开对应单据详情或执行行内动作
 */
import { computed, ref } from 'vue'
import BaseChart from '@/components/BaseChart.vue'
import AppIcon from '@/components/AppIcon.vue'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import { useAction } from '@/composables/useAction'
import type { PreviewDoc } from '@/utils/preview'

const data = useDataStore()
const ui = useUiStore()
const { run } = useAction()

const activeTab = ref('概览')

/* ---------------- 客户选择 ---------------- */
const accounts = computed<any[]>(() => data.rows('account'))

/**
 * 客户名匹配
 * 应收台账里的客户名是截断写法（如「深圳市启明科技有限公司」），
 * 与客户档案（「北京启明科技有限公司」）去掉城市前缀后的前 4 字一致，按此做模糊匹配。
 */
function matchCustomer(rowName: string, name: string): boolean {
  if (!rowName || !name) return false
  if (rowName === name) return true
  return rowName.slice(2, 6) === name.slice(2, 6)
}

/**
 * 默认客户：优先选「各台账都有数据」的客户，保证各页签一打开就有内容；
 * 覆盖度相同时再比记录条数。
 */
function pickDefaultAccount(): string {
  const score = (name: string) => {
    const exact = (key: string, field: string) =>
      data.rows(key).filter((r: any) => r[field] === name).length
    const buckets = [
      exact('opportunity', 'customer'),
      exact('contract', 'customer'),
      exact('follow', 'customer'),
      exact('contact', 'company'),
      exact('receipt', 'customer'),
      data.rows('ar').filter((r: any) => matchCustomer(r.customer, name)).length,
    ]
    const covered = buckets.filter((n) => n > 0).length
    return covered * 1000 + buckets.reduce((a, b) => a + b, 0)
  }
  let best = ''
  let bestScore = -1
  for (const a of accounts.value) {
    const s = score(a.name)
    if (s > bestScore) {
      bestScore = s
      best = a.id
    }
  }
  return best
}

const accountId = ref<string>(pickDefaultAccount())
const account = computed<any>(() => accounts.value.find((a) => a.id === accountId.value) ?? accounts.value[0])
const accountName = computed(() => account.value?.name ?? '')

const accountOptions = computed(() =>
  accounts.value.map((a) => ({ label: a.name, value: a.id })),
)

/* ---------------- 关联单据（全部来自 store） ---------------- */
const custOpportunities = computed<any[]>(() =>
  data.rows('opportunity').filter((o) => o.customer === accountName.value),
)
const custContracts = computed<any[]>(() =>
  data.rows('contract').filter((c) => c.customer === accountName.value),
)
const custAr = computed<any[]>(() =>
  data.rows('ar').filter((a) => matchCustomer(a.customer, accountName.value)),
)
const custReceipts = computed<any[]>(() =>
  data.rows('receipt').filter((r) => r.customer === accountName.value),
)
const custContacts = computed<any[]>(() =>
  data.rows('contact').filter((c) => c.company === accountName.value),
)
const custFollows = computed<any[]>(() =>
  data.rows('follow').filter((f) => f.customer === accountName.value),
)

/* ---------------- 指标 ---------------- */
/** 累计合同额：合同台账合计 */
const contractTotal = computed(() =>
  custContracts.value.reduce((a, c) => a + Number(c.amount || 0), 0),
)
/** 应收余额 */
const arBalance = computed(() => custAr.value.reduce((a, r) => a + Number(r.balance || 0), 0))
/** 逾期应收 */
const overdueAr = computed(() =>
  custAr.value
    .filter((r) => r.status === '已逾期')
    .reduce((a, r) => a + Number(r.balance || 0), 0),
)
/** 跟进次数 */
const followCount = computed(() => custFollows.value.length)

/**
 * 客户健康度（0~100）
 * 四个维度：逾期应收占比、商机推进度、跟进活跃度、合同覆盖情况。
 */
const health = computed(() => {
  let score = 40
  const totalAr = custAr.value.reduce((a, r) => a + Number(r.total || 0), 0)
  score -= totalAr ? (overdueAr.value / totalAr) * 30 : 0
  const avgRate = custOpportunities.value.length
    ? custOpportunities.value.reduce((a, o) => a + Number(o.probability ?? 0), 0) /
      custOpportunities.value.length
    : 0
  score += (avgRate / 100) * 30
  score += Math.min(20, followCount.value * 2)
  if (custContracts.value.some((c) => c.status === '履约中')) score += 10
  return Math.round(Math.max(0, Math.min(100, score)))
})

/* ---------------- 月度合同额与回款额 ---------------- */
const monthSeries = computed(() => {
  const keys = new Set<string>()
  for (const c of custContracts.value) keys.add(String(c.signDate ?? '').slice(0, 7))
  for (const r of custReceipts.value) keys.add(String(r.dueDate ?? '').slice(0, 7))
  const months = [...keys].filter(Boolean).sort().slice(-6)
  const sumBy = (rows: any[], field: string, month: string) =>
    rows
      .filter((r) => String(r[field] ?? '').slice(0, 7) === month)
      .reduce((a, r) => a + Number(r.amount ?? r.actualAmount ?? 0), 0)
  return {
    months,
    contract: months.map((m) => +sumBy(custContracts.value, 'signDate', m).toFixed(1)),
    receipt: months.map((m) => +sumBy(custReceipts.value, 'dueDate', m).toFixed(1)),
  }
})

const trendOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: {
    data: ['合同额', '回款额'],
    right: 0,
    top: 0,
    icon: 'roundRect',
    itemWidth: 10,
    itemHeight: 10,
    textStyle: { fontSize: 12, color: '#4E5969' },
  },
  xAxis: {
    type: 'category',
    data: monthSeries.value.months.map((m) => `${Number(m.slice(5, 7))}月`),
    axisLine: { lineStyle: { color: '#EDEFF2' } },
    axisTick: { show: false },
    axisLabel: { color: '#86909C', fontSize: 11 },
  },
  yAxis: {
    type: 'value',
    name: '万元',
    nameTextStyle: { color: '#86909C', fontSize: 11, padding: [0, 0, 0, 26] },
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: '#F0F1F3' } },
    axisLabel: { color: '#86909C', fontSize: 11 },
  },
  series: [
    {
      name: '合同额',
      type: 'bar',
      barWidth: 14,
      data: monthSeries.value.contract,
      itemStyle: { color: '#165DFF', borderRadius: [3, 3, 0, 0] },
    },
    {
      name: '回款额',
      type: 'bar',
      barWidth: 14,
      data: monthSeries.value.receipt,
      itemStyle: { color: '#E8EAED', borderRadius: [3, 3, 0, 0] },
    },
  ],
}))

/* ---------------- 客户简报 ---------------- */
function nowText(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 未回款：台账字段优先，缺失时按合同额 - 已回款 推算 */
function unpaidOf(c: any): string {
  const amount = Number(c.amount || 0)
  const received = Number(c.received || 0)
  const unpaid = Number(c.unpaid || 0) || amount - received
  return unpaid.toFixed(1)
}

/** 客户简报：基本信息 + 商机漏斗 + 回款情况 + 最近跟进时间轴 */
function openBrief() {
  const doc: PreviewDoc = {
    title: `${accountName.value} · 客户简报`,
    subtitle: `生成于 ${nowText()} · 负责人 ${account.value?.owner ?? '—'} · ${account.value?.level ?? '—'}`,
    sections: [
      {
        title: '客户基本信息',
        type: 'kv',
        rows: [
          { label: '客户编号', value: account.value?.id ?? '—' },
          { label: '客户名称', value: accountName.value },
          { label: '客户等级', value: account.value?.level ?? '—' },
          { label: '合作状态', value: account.value?.status ?? '—' },
          { label: '所属行业', value: account.value?.industry ?? '—' },
          { label: '归属部门', value: account.value?.dept ?? '—' },
          { label: '所在城市', value: account.value?.city ?? '—' },
          { label: '合作始于', value: account.value?.createdAt ?? '—' },
          { label: '续费日期', value: account.value?.renewalDate ?? '—' },
          { label: '联系人数量', value: `${custContacts.value.length} 人` },
          { label: '累计合同额', value: `¥ ${contractTotal.value.toFixed(1)} 万` },
          { label: '应收余额', value: `¥ ${arBalance.value.toFixed(1)} 万` },
        ],
      },
      {
        title: '商机漏斗',
        type: 'table',
        columns: [
          { key: '商机编号', title: '商机编号' },
          { key: '商机名称', title: '商机名称' },
          { key: '阶段', title: '阶段' },
          { key: '金额', title: '金额(万)' },
          { key: '负责人', title: '负责人' },
          { key: '预计成交', title: '预计成交' },
        ],
        data: custOpportunities.value.map((o) => ({
          商机编号: o.id,
          商机名称: o.name,
          阶段: o.stage,
          金额: Number(o.amount || 0).toFixed(1),
          负责人: o.owner,
          预计成交: o.expectedClose,
        })),
      },
      {
        title: '回款情况',
        type: 'table',
        columns: [
          { key: '合同编号', title: '合同编号' },
          { key: '合同名称', title: '合同名称' },
          { key: '合同金额', title: '合同金额(万)' },
          { key: '已回款', title: '已回款(万)' },
          { key: '未回款', title: '未回款(万)' },
          { key: '签订日期', title: '签订日期' },
        ],
        data: custContracts.value.map((c) => ({
          合同编号: c.id,
          合同名称: c.title,
          合同金额: Number(c.amount || 0).toFixed(1),
          已回款: Number(c.received || 0).toFixed(1),
          未回款: unpaidOf(c),
          签订日期: c.signDate,
        })),
      },
      {
        title: '最近跟进时间轴',
        type: 'text',
        text:
          custFollows.value
            .slice(0, 6)
            .map(
              (f) =>
                `${String(f.createdAt).slice(0, 16)} · ${f.way} · ${f.owner}\n${f.content}\n下次跟进：${f.nextAt}`,
            )
            .join('\n\n') || '暂无跟进记录',
      },
    ],
  }
  ui.openPreview('客户简报', doc)
}

/* ---------------- 行内动作 ---------------- */
function openDetail(pageKey: string, row: any) {
  ui.openDetail(pageKey, row)
}

/**
 * 转化单据（跟进记录 / 合同 / 应收）时用的源记录副本：去掉「创建时间」。
 * 源记录的创建时间是日期粒度（2025-07-17），而跟进记录的「记录时间」是
 * 日期时间粒度（YYYY-MM-DD HH:mm），原样带过去会显示 Invalid Date；
 * 去掉后由公共表单按当前时间自动补齐。
 */
function convertSource(row: any): any {
  const r = { ...row }
  delete r.createdAt
  return r
}
</script>

<template>
  <div class="page c360">
    <!-- ============ 客户头 ============ -->
    <div class="card c-head">
      <div class="c-head-main">
        <a-avatar :size="52" shape="square" style="background: #165dff; font-size: 19px; border-radius: 8px">
          {{ String(accountName).slice(0, 2) }}
        </a-avatar>
        <div class="c-head-info">
          <div class="c-head-title">
            <h1>{{ accountName }}</h1>
            <a-tag color="error" :bordered="false">{{ account?.level }}</a-tag>
            <a-tag color="processing" :bordered="false">{{ account?.status }}</a-tag>
            <a-tag :bordered="false">{{ account?.industry }}</a-tag>
          </div>
          <div class="c-head-meta">
            <span><AppIcon name="UserOutlined" :size="12" /> 负责人 {{ account?.owner }}</span>
            <span><AppIcon name="ApartmentOutlined" :size="12" /> {{ account?.dept }}</span>
            <span><AppIcon name="EnvironmentOutlined" :size="12" /> {{ account?.city }}</span>
            <span><AppIcon name="CalendarOutlined" :size="12" /> 合作始于 {{ account?.createdAt }}</span>
            <span><AppIcon name="ClockCircleOutlined" :size="12" /> 续费 {{ account?.renewalDate }}</span>
          </div>
        </div>
      </div>
      <div class="c-head-actions">
        <a-select
          v-model:value="accountId"
          :options="accountOptions"
          show-search
          option-filter-prop="label"
          placeholder="切换客户"
          style="width: 220px"
        />
        <a-button @click="openBrief">
          <template #icon><AppIcon name="FileTextOutlined" :size="14" /></template>
          客户简报
        </a-button>
        <a-button @click="run('新建跟进', { pageKey: 'follow', row: convertSource(account) })">
          <template #icon><AppIcon name="ScheduleOutlined" :size="14" /></template>
          新建跟进
        </a-button>
        <a-button type="primary" @click="run('新建合同', { pageKey: 'contract', row: convertSource(account) })">
          <template #icon><AppIcon name="PlusOutlined" :size="14" /></template>
          新建合同
        </a-button>
      </div>
    </div>

    <!-- ============ 指标 ============ -->
    <div class="c-kpi">
      <div class="c-kpi-item">
        <span>累计合同额</span><b class="num">¥ {{ contractTotal.toFixed(1) }} 万</b>
      </div>
      <div class="c-kpi-item">
        <span>应收余额</span><b class="num warn">¥ {{ arBalance.toFixed(1) }} 万</b>
      </div>
      <div class="c-kpi-item">
        <span>联系人</span><b class="num">{{ custContacts.length }} 人</b>
      </div>
      <div class="c-kpi-item">
        <span>跟进次数</span><b class="num">{{ followCount }} 次</b>
      </div>
      <div class="c-kpi-item">
        <span>客户健康度</span>
        <b class="num health">
          <span class="health-bar"><i :style="{ width: `${health}%` }" /></span>
          {{ health }}
        </b>
      </div>
    </div>

    <!-- ============ Tabs ============ -->
    <div class="card c-body">
      <a-tabs v-model:activeKey="activeTab" class="c-tabs">
        <!-- 概览 -->
        <a-tab-pane key="概览" tab="概览">
          <div class="c-grid">
            <div class="c-chart">
              <div class="c-chart-hd">月度合同额与回款额</div>
              <BaseChart v-if="monthSeries.months.length" :option="trendOption" :height="252" />
              <a-empty v-else description="暂无合同与回款数据" style="padding: 60px 0" />
            </div>
            <div class="c-info">
              <div class="c-chart-hd">客户档案</div>
              <a-descriptions :column="1" size="small" bordered>
                <a-descriptions-item label="客户编码">{{ account?.id }}</a-descriptions-item>
                <a-descriptions-item label="客户等级">{{ account?.level }}</a-descriptions-item>
                <a-descriptions-item label="所属行业">{{ account?.industry }}</a-descriptions-item>
                <a-descriptions-item label="归属部门">{{ account?.dept }}</a-descriptions-item>
                <a-descriptions-item label="所在城市">{{ account?.city }}</a-descriptions-item>
                <a-descriptions-item label="客户负责人">{{ account?.owner }}</a-descriptions-item>
                <a-descriptions-item label="合作始于">{{ account?.createdAt }}</a-descriptions-item>
                <a-descriptions-item label="续费日期">{{ account?.renewalDate }}</a-descriptions-item>
                <a-descriptions-item label="累计合同额">
                  ¥ {{ contractTotal.toFixed(1) }} 万
                </a-descriptions-item>
                <a-descriptions-item label="应收余额">¥ {{ arBalance.toFixed(1) }} 万</a-descriptions-item>
              </a-descriptions>
            </div>
          </div>

          <div class="c-block">
            <div class="c-chart-hd">在谈商机（{{ custOpportunities.length }}）</div>
            <a-table
              :data-source="custOpportunities"
              :pagination="false"
              size="small"
              row-key="id"
              :scroll="{ x: 'max-content' }"
            >
              <a-table-column key="id" title="商机编号" data-index="id" width="112">
                <template #default="{ record }">
                  <a class="c-link" @click="openDetail('opportunity', record)">{{ record.id }}</a>
                </template>
              </a-table-column>
              <a-table-column key="name" title="商机名称" data-index="name" />
              <a-table-column key="stage" title="阶段" data-index="stage" width="100" />
              <a-table-column key="amount" title="金额(万)" data-index="amount" align="right" width="110">
                <template #default="{ record }">{{ Number(record.amount || 0).toFixed(1) }}</template>
              </a-table-column>
              <a-table-column key="owner" title="负责人" data-index="owner" width="90" />
              <a-table-column key="expectedClose" title="预计成交" data-index="expectedClose" width="110" />
              <a-table-column key="act" title="操作" width="130">
                <template #default="{ record }">
                  <a class="c-link" @click="run('推进阶段', { pageKey: 'opportunity', row: record })">推进阶段</a>
                  <a class="c-link" @click="run('转合同', { pageKey: 'opportunity', row: convertSource(record) })">转合同</a>
                </template>
              </a-table-column>
              <template #emptyText><a-empty description="暂无在谈商机" /></template>
            </a-table>
          </div>
        </a-tab-pane>

        <!-- 跟进记录 -->
        <a-tab-pane key="跟进记录" tab="跟进记录">
          <a-timeline class="c-timeline">
            <a-timeline-item
              v-for="(f, i) in custFollows"
              :key="f.id ?? i"
              :color="i === 0 ? '#165DFF' : '#D9DDE3'"
            >
              <div class="tl-row">
                <a-tag :bordered="false" color="blue">{{ f.way }}</a-tag>
                <span class="tl-time">{{ f.createdAt }}</span>
                <span class="tl-owner">{{ f.owner }}</span>
              </div>
              <div class="tl-content">{{ f.content }}</div>
              <div class="tl-next">下次跟进：{{ f.nextAt }}</div>
            </a-timeline-item>
          </a-timeline>
          <a-empty v-if="!custFollows.length" description="暂无跟进记录" style="padding: 40px 0" />
        </a-tab-pane>

        <!-- 合同与订单 -->
        <a-tab-pane key="合同与订单" tab="合同与订单">
          <a-table :data-source="custContracts" :pagination="false" size="middle" row-key="id">
            <a-table-column key="id" title="合同编号" data-index="id" width="120">
              <template #default="{ record }">
                <a class="c-link" @click="openDetail('contract', record)">{{ record.id }}</a>
              </template>
            </a-table-column>
            <a-table-column key="title" title="合同名称" data-index="title" />
            <a-table-column key="amount" title="金额" data-index="amount" align="right" width="140">
              <template #default="{ record }">¥ {{ Number(record.amount || 0).toFixed(2) }}</template>
            </a-table-column>
            <a-table-column key="received" title="已回款" data-index="received" align="right" width="140">
              <template #default="{ record }">¥ {{ Number(record.received || 0).toFixed(2) }}</template>
            </a-table-column>
            <a-table-column key="signDate" title="签订日期" data-index="signDate" width="120" />
            <a-table-column key="status" title="状态" data-index="status" width="100">
              <template #default="{ record }"><a-tag color="success" :bordered="false">{{ record.status }}</a-tag></template>
            </a-table-column>
            <a-table-column key="act" title="操作" width="150">
              <template #default="{ record }">
                <a class="c-link" @click="run('生成应收', { pageKey: 'contract', row: convertSource(record) })">生成应收</a>
                <a class="c-link" @click="openDetail('contract', record)">详情</a>
              </template>
            </a-table-column>
            <template #emptyText><a-empty description="暂无合同记录" /></template>
          </a-table>
        </a-tab-pane>

        <!-- 应收往来 -->
        <a-tab-pane key="应收往来" tab="应收往来">
          <a-table :data-source="custAr" :pagination="false" size="middle" row-key="id">
            <a-table-column key="id" title="单号" data-index="id" width="120">
              <template #default="{ record }">
                <a class="c-link" @click="openDetail('ar', record)">{{ record.id }}</a>
              </template>
            </a-table-column>
            <a-table-column key="period" title="账期" data-index="period" width="100" />
            <a-table-column key="total" title="应收金额" data-index="total" align="right" width="140">
              <template #default="{ record }">¥ {{ Number(record.total || 0).toFixed(2) }}</template>
            </a-table-column>
            <a-table-column key="balance" title="未收余额" data-index="balance" align="right" width="140">
              <template #default="{ record }">¥ {{ Number(record.balance || 0).toFixed(2) }}</template>
            </a-table-column>
            <a-table-column key="dueDate" title="到期日" data-index="dueDate" width="120" />
            <a-table-column key="status" title="状态" data-index="status" width="110" />
            <a-table-column key="act" title="操作" width="130">
              <template #default="{ record }">
                <a class="c-link" @click="run('核销', { pageKey: 'ar', row: record })">核销</a>
                <a class="c-link" @click="openDetail('ar', record)">详情</a>
              </template>
            </a-table-column>
            <template #emptyText><a-empty description="暂无应收往来" /></template>
          </a-table>
        </a-tab-pane>

        <!-- 联系人 -->
        <a-tab-pane key="联系人" tab="联系人">
          <a-table :data-source="custContacts" :pagination="false" size="middle" row-key="id">
            <a-table-column key="name" title="姓名" data-index="name" width="100">
              <template #default="{ record }">
                <a class="c-link" @click="openDetail('contact', record)">{{ record.name }}</a>
              </template>
            </a-table-column>
            <a-table-column key="position" title="职务" data-index="position" width="120" />
            <a-table-column key="department" title="部门" data-index="department" width="120" />
            <a-table-column key="phone" title="电话" data-index="phone" width="140" />
            <a-table-column key="email" title="邮箱" data-index="email" />
            <a-table-column key="act" title="操作" width="150">
              <template #default="{ record }">
                <a class="c-link" @click="run('新建跟进', { pageKey: 'contact', row: convertSource(record) })">新建跟进</a>
                <a class="c-link" @click="openDetail('contact', record)">详情</a>
              </template>
            </a-table-column>
            <template #emptyText><a-empty description="暂无联系人" /></template>
          </a-table>
        </a-tab-pane>

        <!-- 服务与履约 -->
        <a-tab-pane key="服务与履约" tab="服务与履约">
          <div class="c-block">
            <div class="c-chart-hd">服务与履约状态</div>
            <a-table :data-source="custContracts" :pagination="false" size="middle" row-key="id">
              <a-table-column key="id" title="合同编号" data-index="id" width="120">
                <template #default="{ record }">
                  <a class="c-link" @click="openDetail('contract', record)">{{ record.id }}</a>
                </template>
              </a-table-column>
              <a-table-column key="title" title="服务内容" data-index="title" />
              <a-table-column key="startDate" title="服务起始" data-index="startDate" width="120" />
              <a-table-column key="endDate" title="服务到期" data-index="endDate" width="120" />
              <a-table-column key="status" title="履约状态" data-index="status" width="110" />
              <a-table-column key="act" title="操作" width="130">
                <template #default="{ record }">
                  <a class="c-link" @click="run('发起用印', { pageKey: 'contract', row: record })">发起用印</a>
                  <a class="c-link" @click="openDetail('contract', record)">详情</a>
                </template>
              </a-table-column>
              <template #emptyText><a-empty description="暂无服务与履约记录" /></template>
            </a-table>
          </div>
        </a-tab-pane>
      </a-tabs>
    </div>
  </div>
</template>

<script lang="ts">
export default { name: 'Customer360' }
</script>

<style scoped>
.c360 {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.c-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 18px 20px;
  flex-wrap: wrap;
}
.c-head-main {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}
.c-head-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.c-head-title h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}
.c-head-meta {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  margin-top: 7px;
}
.c-head-meta span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  color: var(--text-3);
}
.c-head-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.c-kpi {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 12px;
}
.c-kpi-item {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 13px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-shadow: var(--shadow-card);
}
.c-kpi-item span {
  font-size: 12px;
  color: var(--text-3);
}
.c-kpi-item b {
  font-size: 19px;
  font-weight: 600;
}
.c-kpi-item b.warn {
  color: var(--warning);
}
.health {
  display: flex;
  align-items: center;
  gap: 8px;
}
.health-bar {
  width: 66px;
  height: 6px;
  border-radius: var(--r-full);
  background: var(--border);
  overflow: hidden;
  display: inline-block;
}
.health-bar i {
  display: block;
  height: 100%;
  background: var(--success);
  border-radius: var(--r-full);
  transition: width var(--dur-slow) var(--ease);
}

.c-body {
  padding: 4px 20px 18px;
}
.c-grid {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 20px;
  padding-top: 6px;
}
.c-block {
  margin-top: 20px;
}
.c-chart-hd {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-1);
  margin-bottom: 8px;
}
.c-link {
  color: var(--brand-600);
  cursor: pointer;
  margin-right: 10px;
  white-space: nowrap;
}
.c-link:hover {
  color: var(--brand-700);
  text-decoration: underline;
}

.c-timeline {
  padding-top: 14px;
}
.tl-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}
.tl-time {
  font-size: 12px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}
.tl-owner {
  font-size: 12px;
  color: var(--text-3);
}
.tl-content {
  font-size: 13px;
  color: var(--text-1);
  line-height: 1.7;
  background: var(--surface-sunken);
  border-radius: var(--r-md);
  padding: 9px 12px;
  margin-bottom: 5px;
}
.tl-next {
  font-size: 12px;
  color: var(--brand-600);
}

@media (max-width: 1180px) {
  .c-grid {
    grid-template-columns: 1fr;
  }
}
</style>
