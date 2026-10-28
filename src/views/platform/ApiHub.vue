<script setup lang="ts">
/**
 * 开放平台 API
 * ---------------------------------------------------------------------------
 * 页面上的每个按钮都是真实行为，没有占位提示：
 *  - 接口文档：导出「当前应用」可见的接口清单（CSV 真实下载）
 *  - 创建应用：表单校验（名称 / AppKey 必填、AppKey 唯一）后写入本页应用列表并自动选中
 *  - 在线调试：模拟一次真实请求，按输入拼出响应 JSON，给出耗时与 requestId
 *  - 管理应用：编辑名称 / 描述 / 回调地址 / 状态，保存后就地更新列表
 *  - 重置密钥：二次确认后生成新的随机 AppSecret，并提示调用方更新
 *  - 复制：真实写入剪贴板，按结果提示成功或失败
 */
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { confirmDialog } from '@/utils/confirm'
import AppIcon from '@/components/AppIcon.vue'
import { useDataStore } from '@/stores/data'
import { exportCsv, copyText, stamp } from '@/utils/export'

interface ApiItem {
  group: string
  name: string
  method: string
  url: string
  qps: number
  auth: string
  status: string
  desc: string
}

interface AppItem {
  name: string
  appKey: string
  appSecret: string
  scopes: string[]
  modules: string[]
  qps: number
  status: string
  owner: string
  desc: string
  callback: string
  createdAt: string
}

/** 键值对（调试台里的 query / header 行） */
interface KvRow {
  key: string
  value: string
}

const data = useDataStore()

/* ================================================================== 接口清单 */
const apis: ApiItem[] = [
  { group: 'CRM', name: '查询客户列表', method: 'GET', url: '/open/v1/accounts', qps: 200, auth: 'OAuth2', status: '启用', desc: '分页拉取客户档案，支持行业、客户等级与负责人过滤' },
  { group: 'CRM', name: '创建商机', method: 'POST', url: '/open/v1/opportunities', qps: 100, auth: 'OAuth2', status: '启用', desc: '以客户为起点登记商机，需携带金额与预计成交日期' },
  { group: 'CRM', name: '推进商机阶段', method: 'PATCH', url: '/open/v1/opportunities/{id}/stage', qps: 100, auth: 'OAuth2', status: '启用', desc: '按阶段字典推进商机，非法阶段值返回 4001' },
  { group: 'OA', name: '发起审批实例', method: 'POST', url: '/open/v1/approvals', qps: 150, auth: 'OAuth2', status: '启用', desc: '按流程模板发起审批，返回实例号与首个节点处理人' },
  { group: 'OA', name: '查询待办任务', method: 'GET', url: '/open/v1/todos', qps: 200, auth: 'OAuth2', status: '启用', desc: '拉取当前处理人的待办，支持按流程类型与紧急度筛选' },
  { group: 'OA', name: '审批任务处理', method: 'POST', url: '/open/v1/todos/{id}/action', qps: 150, auth: 'OAuth2', status: '启用', desc: '通过或驳回待办任务，驳回必须填写审批意见' },
  { group: '财务', name: '查询应收余额', method: 'GET', url: '/open/v1/ar/balances', qps: 100, auth: 'OAuth2', status: '启用', desc: '按客户维度汇总应收余额与账龄分布' },
  { group: '财务', name: '推送销项发票', method: 'POST', url: '/open/v1/invoices/output', qps: 50, auth: 'OAuth2', status: '启用', desc: '推送开票申请，支持增值税专票与普票' },
  { group: '财务', name: '导出科目余额表', method: 'GET', url: '/open/v1/gl/balances', qps: 30, auth: 'OAuth2', status: '灰度中', desc: '导出指定账套的科目余额表，仅灰度租户可用' },
  { group: '平台', name: '组织架构同步', method: 'GET', url: '/open/v1/departments', qps: 60, auth: 'API Key', status: '启用', desc: '全量拉取组织架构，用于调用方本地部门字典同步' },
  { group: '平台', name: '用户单点登录', method: 'GET', url: '/open/v1/sso/token', qps: 80, auth: 'API Key', status: '启用', desc: '换取单点登录票据，票据需在 5 分钟内使用' },
  { group: '平台', name: 'Webhook 事件订阅', method: 'POST', url: '/open/v1/webhooks', qps: 20, auth: 'API Key', status: '停用', desc: '注册事件回调地址，支持签名校验与失败重试' },
]

const groups = ['全部', 'CRM', 'OA', '财务', '平台']
const activeGroup = ref('全部')
const keyword = ref('')
const selected = ref<ApiItem>(apis[0])

/* ================================================================== 应用清单 */
const scopeDefs = [
  { value: '只读全部', label: '只读全部（CRM / OA / 财务 / 平台）', modules: ['CRM', 'OA', '财务', '平台'] },
  { value: 'CRM 读取', label: 'CRM 读取（客户 / 商机 / 合同）', modules: ['CRM'] },
  { value: 'CRM 读写', label: 'CRM 读写', modules: ['CRM'] },
  { value: 'OA 读写', label: 'OA 读写（审批 / 待办）', modules: ['OA'] },
  { value: '财务 读写', label: '财务读写（应收 / 发票）', modules: ['财务'] },
  { value: '财务 只读', label: '财务只读（余额 / 报表）', modules: ['财务'] },
  { value: '平台 只读', label: '平台只读（组织 / 用户）', modules: ['平台'] },
  { value: '消息推送', label: '消息推送（Webhook 事件）', modules: ['平台'] },
]
const scopeOptions = scopeDefs.map((o) => ({ value: o.value, label: o.label }))

/**
 * 演示用的开放平台应用。
 * appSecret 全是伪造的随机串（sk_mock_ 前缀刻意避开真实密钥格式），不对应任何真实凭据。
 */
const apps = ref<AppItem[]>([
  {
    name: '客户门户小程序',
    appKey: 'app_9f2a41',
    appSecret: 'sk_mock_7c1d93ab52e6408fb2a1d67c93e5840',
    scopes: ['CRM 读取'],
    modules: ['CRM'],
    qps: 200,
    status: '已授权',
    owner: '孟川',
    desc: '客户自助查询订单进度与合同状态',
    callback: 'https://portal.cloudhub.cn/hooks/open',
    createdAt: '2025-03-12',
  },
  {
    name: '财务中台对接',
    appKey: 'app_3c81de',
    appSecret: 'sk_mock_51be28d09f7c4a63b0d28f5a1c97e432',
    scopes: ['财务 读写'],
    modules: ['财务'],
    qps: 100,
    status: '已授权',
    owner: '陈墨',
    desc: '应收余额与开票数据双向同步',
    callback: 'https://fin-hub.cloudhub.cn/api/open/callback',
    createdAt: '2025-01-08',
  },
  {
    name: '钉钉机器人',
    appKey: 'app_77b0a5',
    appSecret: 'sk_mock_2f8ac60d47e14b39a5c07d3e8b16f9d2',
    scopes: ['OA 读写', '消息推送'],
    modules: ['OA', '平台'],
    qps: 150,
    status: '已授权',
    owner: '苏念',
    desc: '审批待办与到期提醒推送到钉钉群',
    callback: 'https://api.cloudhub.cn/dingtalk/callback',
    createdAt: '2024-11-20',
  },
  {
    name: '第三方 BI 平台',
    appKey: 'app_51e7c2',
    appSecret: 'sk_mock_9a4d30f62c17b8e5d02f4a7b3c6e158',
    scopes: ['只读全部'],
    modules: ['CRM', 'OA', '财务', '平台'],
    qps: 30,
    status: '待授权',
    owner: '林越',
    desc: '经营分析看板只读接入',
    callback: 'https://bi.example.com/open/callback',
    createdAt: '2025-06-02',
  },
])

/** 当前应用：决定右侧可见接口与「接口文档」导出的范围 */
const currentAppId = ref('app_51e7c2')
const currentApp = computed(() => apps.value.find((a) => a.appKey === currentAppId.value) ?? apps.value[0])

/** 负责人候选：取平台真实用户（数据仓库中的 sysUser） */
const ownerOptions = computed(() =>
  data.rows('sysUser').map((u: any) => ({ value: u.name, label: `${u.name} · ${u.dept ?? '未分配部门'}` })),
)

/** 当前应用可见的接口：先按应用权限范围，再按分组与关键字过滤 */
const list = computed(() => {
  const mods = currentApp.value?.modules ?? []
  let rows = apis.filter((a) => mods.includes(a.group))
  if (activeGroup.value !== '全部') rows = rows.filter((a) => a.group === activeGroup.value)
  const q = keyword.value.trim().toLowerCase()
  if (q) {
    rows = rows.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.url.toLowerCase().includes(q) ||
        a.desc.toLowerCase().includes(q),
    )
  }
  return rows
})

/** 选中的接口不再可见时（换应用 / 换分组 / 改关键字）自动落到第一条 */
watch(list, (rows) => {
  if (!rows.length) return
  if (!rows.some((r) => r.url === selected.value.url)) selected.value = rows[0]
})

function selectApi(a: ApiItem) {
  selected.value = a
}

/* ================================================================== 样例构造 */
function sampleBodyFor(group: string): string {
  const map: Record<string, any> = {
    CRM: { customerId: 'CU00042', customerName: '深圳市启明科技有限公司', amount: 1286400, owner: '苏念' },
    OA: { templateId: 'FLOW_EXPENSE', title: '差旅费用报销', urgency: '普通' },
    财务: { booksetId: 'BS001', period: '2025-10', amount: 1286400 },
    平台: { deptCode: 'CH-SALES', syncMode: 'incremental' },
  }
  return JSON.stringify(map[group] ?? {}, null, 2)
}

/** 响应示例：按接口所属模块给出不同结构的 data */
function groupPayload(group: string) {
  if (group === 'CRM') {
    return {
      total: 1286,
      page: 1,
      size: 20,
      items: [
        {
          id: 'CU00042',
          name: '深圳市启明科技有限公司',
          level: '战略客户',
          industry: '智能制造',
          owner: '苏念',
          contractValue: 1286400.0,
          renewalDate: '2026-08-15',
        },
      ],
    }
  }
  if (group === 'OA') {
    return {
      total: 37,
      page: 1,
      size: 20,
      items: [
        {
          id: 'TD0093',
          template: '差旅报销',
          title: '深圳-上海 客户拜访差旅',
          applicant: '周砚',
          urgency: '普通',
          deadline: '2025-10-29',
        },
      ],
    }
  }
  if (group === '财务') {
    return {
      total: 6,
      period: '2025-10',
      items: [
        {
          customer: '深圳市启明科技有限公司',
          balance: 486200.0,
          overdue: 121500.0,
          aging: '30 天内',
        },
      ],
    }
  }
  return {
    total: 13,
    items: [{ id: 'D003', name: '销售中心', code: 'CH-SALES', manager: '苏念', people: 128 }],
  }
}

const requestSample = computed(() => {
  const a = selected.value
  const query = a.method === 'GET' ? '?page=1&size=20' : ''
  const body =
    a.method === 'GET'
      ? ''
      : ` \\\n  -d '${sampleBodyFor(a.group).replace(/\s*\n\s*/g, '')}'`
  return `curl -X ${a.method} "https://api.cloudhub.cn${a.url}${query}" \\
  -H "Authorization: Bearer {access_token}" \\
  -H "X-Tenant-Id: tenant_10286" \\
  -H "X-Timestamp: 1761600000" \\
  -H "X-Signature: HMAC-SHA256(secret, params)"${body}`
})

const responseSample = computed(() =>
  JSON.stringify({ code: 0, message: 'success', data: groupPayload(selected.value.group) }, null, 2),
)

/* ================================================================== 工具函数 */
function todayText(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function nowText(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** 生成随机 AppSecret */
function randomSecret(): string {
  const chars = 'abcdefghijkmnopqrstuvwxyz23456789'
  let s = ''
  for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return `sk_mock_${s}`
}

/** 密钥脱敏展示 */
function maskSecret(s: string): string {
  if (!s) return '—'
  return `${s.slice(0, 12)}****${s.slice(-4)}`
}

/** 权限范围 → 可访问的业务模块 */
function modulesOf(scopes: string[]): string[] {
  const out: string[] = []
  for (const s of scopes) {
    const def = scopeDefs.find((o) => o.value === s)
    for (const m of def?.modules ?? []) if (!out.includes(m)) out.push(m)
  }
  return out
}

/** 真实复制到剪贴板，并按结果提示 */
async function copyTextToClipboard(text: string) {
  if (!text) {
    message.warning('没有可复制的内容')
    return
  }
  const ok = await copyText(text)
  if (ok) message.success('已复制到剪贴板')
  else message.warning('复制失败，请手动选择')
}

/* ================================================================== 接口文档导出 */
function exportDoc() {
  const app = currentApp.value
  if (!app) {
    message.warning('请先选择当前应用')
    return
  }
  const rows = apis
    .filter((a) => app.modules.includes(a.group))
    .map((a) => ({ app: app.name, name: a.name, path: `${a.method} ${a.url}`, method: a.method, desc: a.desc }))
  if (!rows.length) {
    message.warning('当前应用没有可授权的接口')
    return
  }
  exportCsv(
    `接口文档-${app.name}-${stamp()}`,
    [
      { key: 'app', title: '应用名称' },
      { key: 'name', title: '接口名称' },
      { key: 'path', title: '接口路径' },
      { key: 'method', title: '请求方法' },
      { key: 'desc', title: '接口说明' },
    ],
    rows,
  )
  message.success(`已导出「${app.name}」的 ${rows.length} 个接口文档`)
}

/* ================================================================== 创建应用 */
const createOpen = ref(false)
const createFormRef = ref<any>()
const createForm = reactive({
  name: '',
  appKey: '',
  desc: '',
  callback: '',
  scopes: [] as string[],
  owner: '',
  qps: 100,
})

const createRules = {
  name: [{ required: true, message: '请输入应用名称', trigger: 'blur' }],
  appKey: [
    { required: true, message: '请输入应用标识 AppKey', trigger: 'blur' },
    { validator: checkAppKey, trigger: 'blur' },
  ],
}

/** AppKey 唯一性校验（编辑时排除自身） */
function checkAppKey(_rule: any, value: string) {
  const v = (value ?? '').trim()
  if (!v) return Promise.reject(new Error('请输入应用标识 AppKey'))
  if (apps.value.some((a) => a.appKey.toLowerCase() === v.toLowerCase())) {
    return Promise.reject(new Error('该 AppKey 已存在，请更换'))
  }
  return Promise.resolve()
}

function openCreate() {
  Object.assign(createForm, {
    name: '',
    appKey: '',
    desc: '',
    callback: '',
    scopes: [],
    owner: ownerOptions.value[0]?.value ?? '',
    qps: 100,
  })
  createOpen.value = true
}

async function submitCreate() {
  try {
    await createFormRef.value?.validate()
  } catch {
    message.warning('请完善应用名称与 AppKey')
    return
  }
  const app: AppItem = {
    name: createForm.name.trim(),
    appKey: createForm.appKey.trim(),
    appSecret: randomSecret(),
    scopes: [...createForm.scopes],
    modules: modulesOf(createForm.scopes),
    qps: Number(createForm.qps) || 100,
    status: '待授权',
    owner: createForm.owner || '未指派',
    desc: createForm.desc.trim(),
    callback: createForm.callback.trim(),
    createdAt: todayText(),
  }
  apps.value.unshift(app)
  currentAppId.value = app.appKey
  createOpen.value = false
  message.success('应用创建成功，AppKey 已生成')
}

/* ================================================================== 管理应用 */
const editOpen = ref(false)
const editFormRef = ref<any>()
const editingApp = ref<AppItem | null>(null)
const editForm = reactive({
  name: '',
  desc: '',
  callback: '',
  status: '已授权',
  owner: '',
  qps: 100,
})
const editRules = {
  name: [{ required: true, message: '请输入应用名称', trigger: 'blur' }],
}

function openEdit(app: AppItem) {
  editingApp.value = app
  Object.assign(editForm, {
    name: app.name,
    desc: app.desc,
    callback: app.callback,
    status: app.status,
    owner: app.owner,
    qps: app.qps,
  })
  editOpen.value = true
}

async function submitEdit() {
  try {
    await editFormRef.value?.validate()
  } catch {
    message.warning('请填写应用名称')
    return
  }
  const app = editingApp.value
  if (!app) return
  app.name = editForm.name.trim()
  app.desc = editForm.desc.trim()
  app.callback = editForm.callback.trim()
  app.status = editForm.status
  app.owner = editForm.owner || app.owner
  app.qps = Number(editForm.qps) || app.qps
  editOpen.value = false
  message.success(`应用「${app.name}」信息已更新`)
}

/* ================================================================== 重置密钥 */
function resetSecret(app: AppItem) {
  confirmDialog({
    title: `确认重置「${app.name}」的 AppSecret？`,
    content: '重置后旧密钥立即失效，调用方需同步更新 AppSecret 才能继续调用。',
    okText: '确认重置',
    okType: 'danger',
    cancelText: '取消',
    onOk: () => {
      app.appSecret = randomSecret()
      message.success('密钥已重置，请及时更新调用方')
    },
  })
}

/* ================================================================== 在线调试 */
const debugOpen = ref(false)
const debugLoading = ref(false)
const debugResult = ref<{ json: string; elapsed: number; requestId: string } | null>(null)
const dbg = reactive({
  method: 'GET',
  path: '',
  query: [] as KvRow[],
  headers: [] as KvRow[],
  body: '',
})
const methodOptions = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((v) => ({ value: v, label: v }))

function openDebug() {
  const a = selected.value
  dbg.method = a.method
  dbg.path = a.url
  dbg.query = [
    { key: 'page', value: '1' },
    { key: 'size', value: '20' },
  ]
  dbg.headers = [
    { key: 'Authorization', value: 'Bearer {access_token}' },
    { key: 'X-Tenant-Id', value: 'tenant_10286' },
  ]
  dbg.body = a.method === 'GET' ? '' : sampleBodyFor(a.group)
  debugResult.value = null
  debugOpen.value = true
}

function addKv(target: KvRow[]) {
  target.push({ key: '', value: '' })
}

function removeKv(target: KvRow[], i: number) {
  target.splice(i, 1)
}

/** 发送调试请求：参数不合法直接拦截，通过后模拟网关响应 */
async function sendDebug() {
  const path = dbg.path.trim()
  if (!path) {
    message.warning('请求路径不能为空')
    return
  }
  if (!path.startsWith('/')) {
    message.warning('请求路径需以 / 开头')
    return
  }
  const query = dbg.query.filter((r) => r.key.trim())
  if (!query.length) {
    message.warning('请至少填写一个查询参数')
    return
  }
  let bodyObj: any = null
  const bodyText = (dbg.body ?? '').trim()
  if (bodyText) {
    try {
      bodyObj = JSON.parse(bodyText)
    } catch {
      message.warning('请求体不是合法的 JSON，无法发送')
      return
    }
  }

  debugLoading.value = true
  debugResult.value = null
  const t0 = Date.now()
  await new Promise((r) => setTimeout(r, 400 + Math.floor(Math.random() * 300)))
  const elapsed = Date.now() - t0
  const requestId = `req_${Math.random().toString(36).slice(2, 12)}`
  const payload = {
    code: 0,
    message: 'success',
    data: {
      requestId,
      serverTime: nowText(),
      method: dbg.method,
      path,
      query: Object.fromEntries(query.map((r) => [r.key.trim(), r.value])),
      headers: Object.fromEntries(dbg.headers.filter((h) => h.key.trim()).map((h) => [h.key.trim(), h.value])),
      body: bodyObj,
      ...groupPayload(selected.value.group),
    },
    elapsed,
  }
  debugResult.value = { json: JSON.stringify(payload, null, 2), elapsed, requestId }
  debugLoading.value = false
}
</script>

<template>
  <div class="page api-page">
    <div class="ap-head">
      <div>
        <h1>开放平台 API</h1>
        <p>标准 REST 接口、Webhook 事件与应用授权管理</p>
      </div>
      <a-space>
        <a-button @click="exportDoc">
          <template #icon><AppIcon name="DownloadOutlined" :size="14" /></template>
          导出接口文档
        </a-button>
        <a-button type="primary" @click="openCreate">
          <template #icon><AppIcon name="PlusOutlined" :size="14" /></template>
          创建应用
        </a-button>
      </a-space>
    </div>

    <div class="ap-kpi">
      <div class="apk"><span>当前应用接口</span><b class="num">{{ list.length }}</b></div>
      <div class="apk"><span>接入应用</span><b class="num">{{ apps.length }}</b></div>
      <div class="apk"><span>今日调用</span><b class="num">286,412</b></div>
      <div class="apk"><span>平均响应</span><b class="num">86 ms</b></div>
      <div class="apk"><span>成功率</span><b class="num ok">99.96%</b></div>
    </div>

    <div class="ap-grid">
      <!-- 左：接口列表 -->
      <div class="card ap-list-card">
        <div class="card-hd">
          <h3>接口列表</h3>
          <a-input v-model:value="keyword" size="small" placeholder="搜索接口" allow-clear style="width: 150px">
            <template #prefix><AppIcon name="SearchOutlined" :size="12" /></template>
          </a-input>
        </div>
        <div class="ap-filters">
          <a-radio-group v-model:value="activeGroup" size="small">
            <a-radio-button v-for="g in groups" :key="g" :value="g">{{ g }}</a-radio-button>
          </a-radio-group>
        </div>
        <div class="ap-app-tip">
          <span class="ap-app-name">{{ currentApp?.name }}</span>
          <span class="ap-app-desc">{{ currentApp?.scopes.join('、') || '未授权任何权限范围' }}</span>
        </div>
        <div class="ap-list">
          <div
            v-for="a in list"
            :key="a.url"
            class="api-row"
            :class="{ on: selected.url === a.url }"
            @click="selectApi(a)"
          >
            <span class="api-method" :class="a.method.toLowerCase()">{{ a.method }}</span>
            <div class="api-main">
              <div class="api-name">{{ a.name }}</div>
              <div class="api-path">{{ a.method }} {{ a.url }}</div>
            </div>
            <span class="api-tag" :class="a.group">{{ a.group }}</span>
          </div>
          <a-empty v-if="!list.length" description="无匹配接口" style="padding: 30px 0" />
        </div>
      </div>

      <!-- 右：接口详情 -->
      <div class="ap-detail">
        <div class="card">
          <div class="card-hd">
            <h3>{{ selected.name }}</h3>
            <a-space>
              <a-tag :color="selected.status === '启用' ? 'success' : 'warning'" :bordered="false">{{ selected.status }}</a-tag>
              <a-button size="small" type="primary" @click="openDebug">在线调试</a-button>
            </a-space>
          </div>
          <div class="card-bd">
            <a-descriptions :column="2" size="small" bordered>
              <a-descriptions-item label="接口路径"><code>{{ selected.method }} {{ selected.url }}</code></a-descriptions-item>
              <a-descriptions-item label="认证方式">{{ selected.auth }}</a-descriptions-item>
              <a-descriptions-item label="限流阈值">{{ selected.qps }} QPS / 应用</a-descriptions-item>
              <a-descriptions-item label="所属模块">{{ selected.group }}</a-descriptions-item>
              <a-descriptions-item label="接口说明" :span="2">{{ selected.desc }}</a-descriptions-item>
            </a-descriptions>
          </div>
        </div>

        <div class="card">
          <div class="card-hd">
            <h3>请求示例</h3>
            <a class="cp" @click="copyTextToClipboard(requestSample)">复制</a>
          </div>
          <div class="card-bd">
            <pre class="code"><code>{{ requestSample }}</code></pre>
          </div>
        </div>

        <div class="card">
          <div class="card-hd">
            <h3>响应示例</h3>
            <a class="cp" @click="copyTextToClipboard(responseSample)">复制</a>
          </div>
          <div class="card-bd">
            <pre class="code"><code>{{ responseSample }}</code></pre>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-hd">
        <h3>接入应用</h3>
        <span class="ap-hint">点击应用名称可切换当前应用，接口清单与文档导出随应用权限范围变化</span>
      </div>
      <div class="card-bd" style="padding: 0">
        <a-table :data-source="apps" :pagination="false" size="small" row-key="appKey">
          <a-table-column key="name" title="应用名称" width="210">
            <template #default="{ record }">
              <div class="ap-app-cell">
                <a class="cp" @click="currentAppId = record.appKey">{{ record.name }}</a>
                <span class="ap-app-sub">{{ record.desc || '—' }}</span>
              </div>
            </template>
          </a-table-column>
          <a-table-column key="appKey" title="App Key" width="150">
            <template #default="{ record }"><code class="mono">{{ record.appKey }}</code></template>
          </a-table-column>
          <a-table-column key="appSecret" title="App Secret" width="200">
            <template #default="{ record }">
              <span class="ap-secret" :title="record.appSecret">{{ maskSecret(record.appSecret) }}</span>
              <a class="cp" @click="copyTextToClipboard(record.appSecret)">复制</a>
            </template>
          </a-table-column>
          <a-table-column key="scopes" title="授权范围" width="180">
            <template #default="{ record }">
              <a-tag v-for="s in record.scopes" :key="s" :bordered="false" color="blue">{{ s }}</a-tag>
              <span v-if="!record.scopes.length" class="text-3">—</span>
            </template>
          </a-table-column>
          <a-table-column key="qps" title="限流" width="86" align="right">
            <template #default="{ record }">{{ record.qps }} QPS</template>
          </a-table-column>
          <a-table-column key="owner" title="负责人" width="92" data-index="owner" />
          <a-table-column key="status" title="状态" width="92">
            <template #default="{ record }">
              <a-tag :color="record.status === '已授权' ? 'success' : 'warning'" :bordered="false">{{ record.status }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column key="current" title="当前应用" width="96">
            <template #default="{ record }">
              <a-tag v-if="record.appKey === currentAppId" color="processing" :bordered="false">当前</a-tag>
              <a v-else class="cp" @click="currentAppId = record.appKey">设为当前</a>
            </template>
          </a-table-column>
          <a-table-column key="act" title="操作" width="150">
            <template #default="{ record }">
              <a class="cp" @click="openEdit(record)">管理</a>
              <a class="cp danger" @click="resetSecret(record)">重置密钥</a>
            </template>
          </a-table-column>
        </a-table>
      </div>
    </div>

    <!-- ================= 创建应用 ================= -->
    <a-modal
      v-model:open="createOpen"
      title="创建应用"
      :width="560"
      ok-text="创建"
      cancel-text="取消"
      :mask-closable="false"
      @ok="submitCreate"
    >
      <a-form ref="createFormRef" :model="createForm" :rules="createRules" layout="vertical">
        <a-form-item label="应用名称" name="name">
          <a-input v-model:value="createForm.name" placeholder="如：客户门户小程序" allow-clear />
        </a-form-item>
        <a-form-item label="应用标识 AppKey" name="appKey">
          <a-input v-model:value="createForm.appKey" placeholder="如：app_9f2a41" allow-clear />
        </a-form-item>
        <a-form-item label="应用描述" name="desc">
          <a-textarea v-model:value="createForm.desc" :rows="2" placeholder="简述该应用的用途与调用场景" />
        </a-form-item>
        <a-form-item label="回调地址" name="callback">
          <a-input v-model:value="createForm.callback" placeholder="https://your-domain.com/open/callback" allow-clear />
        </a-form-item>
        <a-form-item label="权限范围" name="scopes">
          <a-select
            v-model:value="createForm.scopes"
            mode="multiple"
            :options="scopeOptions"
            placeholder="可多选，决定该应用可见的接口"
          />
        </a-form-item>
        <div class="form-2col">
          <a-form-item label="负责人" name="owner">
            <a-select v-model:value="createForm.owner" :options="ownerOptions" placeholder="选择负责人" allow-clear />
          </a-form-item>
          <a-form-item label="限流阈值 (QPS)" name="qps">
            <a-input-number v-model:value="createForm.qps" :min="1" :max="1000" style="width: 100%" />
          </a-form-item>
        </div>
      </a-form>
    </a-modal>

    <!-- ================= 管理应用 ================= -->
    <a-modal
      v-model:open="editOpen"
      title="管理应用"
      :width="520"
      ok-text="保存"
      cancel-text="取消"
      :mask-closable="false"
      @ok="submitEdit"
    >
      <a-form ref="editFormRef" :model="editForm" :rules="editRules" layout="vertical">
        <a-form-item label="应用名称" name="name">
          <a-input v-model:value="editForm.name" allow-clear />
        </a-form-item>
        <a-form-item label="应用描述" name="desc">
          <a-textarea v-model:value="editForm.desc" :rows="2" />
        </a-form-item>
        <a-form-item label="回调地址" name="callback">
          <a-input v-model:value="editForm.callback" allow-clear />
        </a-form-item>
        <div class="form-2col">
          <a-form-item label="状态" name="status">
            <a-select
              v-model:value="editForm.status"
              :options="[
                { value: '已授权', label: '已授权' },
                { value: '待授权', label: '待授权' },
                { value: '已停用', label: '已停用' },
              ]"
            />
          </a-form-item>
          <a-form-item label="负责人" name="owner">
            <a-select v-model:value="editForm.owner" :options="ownerOptions" allow-clear />
          </a-form-item>
        </div>
        <a-form-item label="限流阈值 (QPS)" name="qps">
          <a-input-number v-model:value="editForm.qps" :min="1" :max="1000" style="width: 100%" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- ================= 在线调试 ================= -->
    <a-drawer v-model:open="debugOpen" title="在线调试" :width="960" placement="right">
      <div class="dbg-head">
        <a-tag :class="`api-method ${selected.method.toLowerCase()}`" :bordered="false">{{ selected.method }}</a-tag>
        <span class="dbg-title">{{ selected.name }}</span>
        <code class="mono">{{ selected.url }}</code>
      </div>

      <div class="dbg-grid">
        <!-- 左：请求参数 -->
        <div class="dbg-left">
          <div class="dbg-sec">
            <div class="dbg-h">基础参数</div>
            <div class="dbg-row2">
              <div class="dbg-f">
                <label>请求方法</label>
                <a-select v-model:value="dbg.method" :options="methodOptions" size="small" />
              </div>
              <div class="dbg-f dbg-grow">
                <label>请求路径</label>
                <a-input v-model:value="dbg.path" size="small" placeholder="/open/v1/accounts" />
              </div>
            </div>
          </div>

          <div class="dbg-sec">
            <div class="dbg-h">
              查询参数
              <a class="cp" @click="addKv(dbg.query)">
                <AppIcon name="PlusOutlined" :size="11" /> 添加
              </a>
            </div>
            <div v-for="(r, i) in dbg.query" :key="i" class="dbg-kv">
              <a-input v-model:value="r.key" size="small" placeholder="参数名" />
              <a-input v-model:value="r.value" size="small" placeholder="参数值" />
              <a class="dbg-del" @click="removeKv(dbg.query, i)"><AppIcon name="CloseOutlined" :size="12" /></a>
            </div>
            <p v-if="!dbg.query.length" class="dbg-none">暂无查询参数，点击「添加」补充</p>
          </div>

          <div class="dbg-sec">
            <div class="dbg-h">
              请求头
              <a class="cp" @click="addKv(dbg.headers)">
                <AppIcon name="PlusOutlined" :size="11" /> 添加
              </a>
            </div>
            <div v-for="(r, i) in dbg.headers" :key="i" class="dbg-kv">
              <a-input v-model:value="r.key" size="small" placeholder="Header" />
              <a-input v-model:value="r.value" size="small" placeholder="值" />
              <a class="dbg-del" @click="removeKv(dbg.headers, i)"><AppIcon name="CloseOutlined" :size="12" /></a>
            </div>
          </div>

          <div class="dbg-sec">
            <div class="dbg-h">请求体</div>
            <a-textarea
              v-model:value="dbg.body"
              :rows="6"
              placeholder="JSON 请求体，GET 请求可留空"
              class="dbg-body"
            />
          </div>
        </div>

        <!-- 右：响应 -->
        <div class="dbg-right">
          <div class="dbg-h">
            响应
            <a-space v-if="debugResult">
              <a-tag color="success" :bordered="false">HTTP 200</a-tag>
              <a-tag :bordered="false">耗时 {{ debugResult.elapsed }} ms</a-tag>
              <a class="cp" @click="copyTextToClipboard(debugResult.json)">复制</a>
            </a-space>
          </div>
          <a-spin :spinning="debugLoading">
            <div v-if="debugResult" class="dbg-res">
              <div class="dbg-meta">
                <span>requestId</span>
                <code class="mono">{{ debugResult.requestId }}</code>
              </div>
              <pre class="code"><code>{{ debugResult.json }}</code></pre>
            </div>
            <div v-else-if="!debugLoading" class="dbg-empty">
              <AppIcon name="ApiOutlined" :size="22" />
              <p>填写左侧参数后点击「发送」，这里会返回模拟的网关响应</p>
            </div>
          </a-spin>
        </div>
      </div>

      <template #footer>
        <div class="dbg-foot">
          <span class="ap-hint">调试请求在浏览器内模拟，不会真实调用网关</span>
          <a-space>
            <a-button @click="debugOpen = false">关闭</a-button>
            <a-button type="primary" :loading="debugLoading" @click="sendDebug">
              <template #icon><AppIcon name="ThunderboltOutlined" :size="14" /></template>
              发送
            </a-button>
          </a-space>
        </div>
      </template>
    </a-drawer>
  </div>
</template>

<style scoped>
.api-page { display: flex; flex-direction: column; gap: 12px; }
.ap-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.ap-head h1 { margin: 0 0 5px; font-size: 20px; font-weight: 600; }
.ap-head p { margin: 0; font-size: 13px; color: var(--text-3); }

.ap-kpi { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.apk {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg);
  padding: 13px 16px; display: flex; flex-direction: column; gap: 5px; box-shadow: var(--shadow-card);
}
.apk span { font-size: 12px; color: var(--text-3); }
.apk b { font-size: 20px; font-weight: 600; }
.apk b.ok { color: var(--success); }

.ap-grid { display: grid; grid-template-columns: 380px minmax(0, 1fr); gap: 12px; align-items: start; }
.ap-list-card { display: flex; flex-direction: column; overflow: hidden; }
.ap-filters { padding: 10px 14px; border-bottom: 1px solid var(--border-subtle); }
.ap-app-tip {
  display: flex; align-items: baseline; gap: 8px; padding: 9px 16px;
  background: var(--surface-sunken); border-bottom: 1px solid var(--border-subtle);
}
.ap-app-name { font-size: 12.5px; font-weight: 600; color: var(--text-1); }
.ap-app-desc { font-size: 11.5px; color: var(--text-3); }
.ap-list { max-height: 460px; overflow-y: auto; }
.api-row {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 16px; cursor: pointer;
  border-left: 2px solid transparent;
  transition: background-color var(--dur-base) var(--ease);
}
.api-row:hover { background: var(--surface-hover); }
.api-row.on { background: var(--brand-050); border-left-color: var(--brand-600); }
.api-method {
  flex: none; font-size: 10.5px; font-weight: 600; padding: 2px 6px;
  border-radius: var(--r-sm); letter-spacing: 0.3px;
}
.api-method.get { background: var(--success-bg); color: var(--success); }
.api-method.post { background: var(--brand-050); color: var(--brand-600); }
.api-method.patch { background: var(--warning-bg); color: var(--warning); }
.api-method.put { background: var(--warning-bg); color: var(--warning); }
.api-method.delete { background: var(--danger-bg); color: var(--danger); }
.api-main { flex: 1; min-width: 0; }
.api-name { font-size: 13px; color: var(--text-1); }
.api-path { font-size: 11px; color: var(--text-3); font-family: var(--font-num); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.api-tag { flex: none; font-size: 11px; padding: 1px 6px; border-radius: var(--r-sm); background: var(--neutral-bg); color: var(--text-2); }
.api-tag.CRM { background: #e8f3ff; color: #165dff; }
.api-tag.OA { background: #e8ffea; color: #00b42a; }
.api-tag.财务 { background: #fff7e8; color: #ff7d00; }
.api-tag.平台 { background: #f5e8ff; color: #722ed1; }

.ap-detail { display: flex; flex-direction: column; gap: 12px; }
.code {
  margin: 0; padding: 14px 16px; background: #17171a; border-radius: var(--r-md);
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 12px; line-height: 1.75; color: #d6d9de; overflow-x: auto;
}
.cp { font-size: 12.5px; color: var(--brand-600); cursor: pointer; margin-right: 12px; }
.cp:hover { color: var(--brand-700); }
.cp.danger { color: var(--danger); }
.cp.danger:hover { color: #cb2634; }
code { font-family: 'JetBrains Mono', Consolas, monospace; }
.mono { font-size: 12px; }

.ap-hint { font-size: 12px; color: var(--text-3); }
.ap-app-cell { display: flex; flex-direction: column; gap: 2px; }
.ap-app-cell .cp { margin-right: 0; }
.ap-app-sub { font-size: 11.5px; color: var(--text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap-secret { font-family: var(--font-num); font-size: 12px; color: var(--text-2); margin-right: 10px; }

.form-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }

/* ---------------- 在线调试 ---------------- */
.dbg-head {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding-bottom: 14px; margin-bottom: 14px; border-bottom: 1px solid var(--border-subtle);
}
.dbg-title { font-size: 14px; font-weight: 600; color: var(--text-1); }
.dbg-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
.dbg-left { display: flex; flex-direction: column; gap: 16px; }
.dbg-sec { border: 1px solid var(--border-subtle); border-radius: var(--r-md); padding: 12px 14px; }
.dbg-h {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  font-size: 13px; font-weight: 600; color: var(--text-1); margin-bottom: 10px;
}
.dbg-h .cp { margin-right: 0; display: inline-flex; align-items: center; gap: 3px; font-weight: 400; }
.dbg-row2 { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 10px; }
.dbg-f { display: flex; flex-direction: column; gap: 4px; }
.dbg-f label { font-size: 11.5px; color: var(--text-3); }
.dbg-kv { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) 20px; gap: 6px; margin-bottom: 6px; }
.dbg-del { color: var(--text-4); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.dbg-del:hover { color: var(--danger); }
.dbg-none { margin: 0; font-size: 12px; color: var(--text-4); }
.dbg-body { font-family: 'JetBrains Mono', Consolas, monospace; font-size: 12px; }
.dbg-right {
  border: 1px solid var(--border-subtle); border-radius: var(--r-md); padding: 12px 14px;
  background: var(--surface-sunken); min-height: 320px;
}
.dbg-res .code { margin-top: 10px; }
.dbg-meta { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-3); }
.dbg-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 70px 20px; color: var(--text-4); }
.dbg-empty p { margin: 0; font-size: 12.5px; text-align: center; }
.dbg-foot { display: flex; align-items: center; justify-content: space-between; gap: 16px; }

@media (max-width: 1240px) {
  .ap-grid { grid-template-columns: 1fr; }
  .dbg-grid { grid-template-columns: 1fr; }
}
</style>
