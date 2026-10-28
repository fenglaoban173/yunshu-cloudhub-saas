<script setup lang="ts">
/**
 * 登录页
 * ---------------------------------------------------------------------------
 * 每一处交互都是完整流程，没有占位提示：
 *  - 密码登录：AntD 规则校验 → 账号 / 租户 / 密码核对 → 提交中 loading 与禁用 → 进入承接页
 *  - SSO（钉钉 / 企业微信 / 飞书）：按钮进入 loading，模拟授权跳转后按对应演示身份完成登录
 *  - 忘记密码：真实校验两次密码一致且不少于 6 位，重置后可用新密码登录
 *  - 演示身份：切换后账号 / 密码 / 租户同步刷新，并显示当前身份说明
 *  - 页脚协议：打开全局预览抽屉，展示条款正文
 */
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { useUserStore } from '@/stores/user'
import { useUiStore } from '@/stores/ui'
import { useChromeStore } from '@/stores/chrome'
import { demoUsers, defaultDemoUser, findDemoUser } from '@/mock/users'
import AppIcon from '@/components/AppIcon.vue'
import PreviewDrawer from '@/components/PreviewDrawer.vue'

const route = useRoute()
const router = useRouter()
const user = useUserStore()
const ui = useUiStore()
const chrome = useChromeStore()

/**
 * 登录后的落点。
 * 深链优先（登录前访问过某个具体页面）；否则看偏好设置里的「登录落地页」：
 *   应用门户 → /portal；上次所在应用 → 该应用域的工作台。
 */
function landingPath() {
  if (chrome.prefs.landing === 'last') return user.lastAppEntry || '/portal'
  return '/portal'
}

/** 本次会话内被重置过密码的账号（演示环境无后端，仅前端记录，不改动任何业务数据） */
const resetPwd = reactive<Record<string, string>>({})

const form = reactive({
  tenant: defaultDemoUser.tenant,
  /** 演示身份下拉的选中项 */
  identity: defaultDemoUser.account,
  account: defaultDemoUser.account,
  password: defaultDemoUser.password,
  remember: true,
})

const loading = ref(false)
/** 正在跳转授权的 SSO 渠道 */
const ssoLoading = ref('')
const formRef = ref<any>()

const rules = {
  account: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

const tenants = [
  { label: '云枢科技集团', value: '云枢科技集团' },
  { label: '深圳启明科技', value: '深圳启明科技' },
  { label: '中科智联信息', value: '中科智联信息' },
]

/** 演示身份：不同角色被授权的应用域不同，登录后看到的菜单与承接页也不一样 */
const identityOptions = demoUsers.map((u) => ({
  value: u.account,
  label: `${u.name} · ${u.role}`,
}))

/** 当前身份说明（随账号输入实时变化） */
const currentDemo = computed(() => findDemoUser(form.account))

/** 记住上次登录的账号，回填时只认演示身份 */
const remembered = localStorage.getItem('ch_remember_account') ?? ''
if (remembered && findDemoUser(remembered)) {
  const d = findDemoUser(remembered)!
  form.identity = d.account
  form.account = d.account
  form.password = d.password
}

/* ================================================================== 身份与租户 */
function onIdentityChange(account: string) {
  const demo = findDemoUser(account)
  if (!demo) return
  form.identity = demo.account
  form.account = demo.account
  // 若该账号在本会话被重置过密码，回填新密码，保持可登录
  form.password = resetPwd[demo.account] ?? demo.password
  form.tenant = demo.tenant
  formRef.value?.clearValidate()
  message.info(`已切换到「${demo.name} · ${demo.role}」`)
}

function onTenantChange(tenant: string) {
  form.tenant = tenant
  const demo = findDemoUser(form.account)
  if (demo && demo.tenant !== tenant) {
    // 账号归属与所选租户不一致，清空后重新输入（演示身份仅归属集团租户）
    form.identity = ''
    form.account = ''
    form.password = ''
    message.info(`「${tenant}」暂未配置演示身份，请手动输入账号或切换回「${demo.tenant}」`)
  }
}

/* ================================================================== 登录提交 */
async function onSubmit() {
  if (loading.value) return
  try {
    await formRef.value?.validate()
  } catch {
    message.warning('请填写完整的账号与密码')
    return
  }
  const account = form.account.trim()
  const demo = findDemoUser(account)
  if (!demo) {
    message.error('该账号不属于演示租户，请使用演示身份登录')
    return
  }
  if (demo.tenant !== form.tenant) {
    message.error(`该账号属于「${demo.tenant}」，与所选租户不一致`)
    return
  }
  const expected = resetPwd[account] ?? demo.password
  if (form.password !== expected) {
    message.error('密码错误，请重新输入')
    return
  }

  loading.value = true
  await new Promise((r) => setTimeout(r, 700))
  user.login(account)
  if (form.remember) localStorage.setItem('ch_remember_account', account)
  else localStorage.removeItem('ch_remember_account')
  loading.value = false
  message.success('登录成功，请选择要进入的系统')
  // 深链场景（登录前访问了某个具体页面）回到原页面，否则按登录落地页偏好进入
  const redirect = (route.query.redirect as string) || landingPath()
  router.push(redirect)
}

/* ================================================================== SSO 单点登录 */
const ssoChannels = [
  { type: '钉钉', label: '钉钉扫码', icon: 'ThunderboltOutlined', account: 'super@cloudhub.cn' },
  { type: '企业微信', label: '企业微信', icon: 'MessageOutlined', account: 'admin@cloudhub.cn' },
  { type: '飞书', label: '飞书', icon: 'ReadOutlined', account: 'sales@cloudhub.cn' },
].map((c) => {
  const d = findDemoUser(c.account)!
  return { ...c, name: d.name, role: d.role }
})

async function sso(type: string) {
  if (ssoLoading.value) return
  const ch = ssoChannels.find((c) => c.type === type)
  if (!ch) return
  ssoLoading.value = type
  // 模拟跳转到第三方授权页 → 用户确认授权 → 回调带回身份
  await new Promise((r) => setTimeout(r, 900 + Math.floor(Math.random() * 300)))
  const demo = findDemoUser(ch.account)
  ssoLoading.value = ''
  if (!demo) return
  user.login(demo.account)
  if (form.remember) localStorage.setItem('ch_remember_account', demo.account)
  message.success(`已通过${type}登录`)
  const redirect = (route.query.redirect as string) || landingPath()
  router.push(redirect)
}

/* ================================================================== 忘记密码 */
const pwdOpen = ref(false)
const pwdFormRef = ref<any>()
const pwdForm = reactive({ account: '', password: '', confirm: '' })
const pwdRules = {
  account: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '新密码不少于 6 位', trigger: 'blur' },
  ],
  confirm: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule: any, value: string) =>
        value === pwdForm.password ? Promise.resolve() : Promise.reject(new Error('两次输入的密码不一致')),
      trigger: 'blur',
    },
  ],
}

function openForgot() {
  pwdForm.account = form.account
  pwdForm.password = ''
  pwdForm.confirm = ''
  pwdOpen.value = true
}

async function submitPwd() {
  try {
    await pwdFormRef.value?.validate()
  } catch {
    message.warning('请按提示填写完整的重置信息')
    return
  }
  const account = pwdForm.account.trim()
  const demo = findDemoUser(account)
  if (!demo) {
    message.error('该账号不存在，无法重置密码')
    return
  }
  // 演示环境无后端，只在前端记录新密码，不改动任何业务数据
  resetPwd[account] = pwdForm.password
  pwdOpen.value = false
  form.identity = account
  form.account = account
  form.password = pwdForm.password
  message.success('密码已重置，请使用新密码登录')
}

/* ================================================================== 页脚协议 */
const agreements: Record<string, any> = {
  服务协议: {
    title: '服务协议',
    subtitle: '云枢 CloudHub 企业服务条款 · 2025 年 10 月版',
    sections: [
      {
        title: '一、服务范围',
        type: 'text',
        text:
          '云枢 CloudHub（简称「本平台」）面向企业客户提供 CRM、OA、财务核算与开放平台 API 四类应用域服务。' +
          '客户开通租户后，可按订阅套餐获得对应模块的使用权，并可自行创建子账号、角色与数据权限。',
      },
      {
        title: '二、账号与责任',
        type: 'kv',
        rows: [
          { label: '账号主体', value: '客户租户管理员及其授权子账号' },
          { label: '计费方式', value: '按订阅套餐年费 + 超额调用量阶梯计费' },
          { label: '服务等级', value: '旗舰版 99.95% / 专业版 99.9% / 基础版 99.5%' },
          { label: '续费与退订', value: '到期前 30 日可续费，退订需提前 15 个工作日申请' },
        ],
      },
      {
        title: '三、客户义务',
        type: 'checklist',
        data: [
          { 事项: '账号安全：管理员离职后 24 小时内回收权限', 范围: '客户 IT 负责人', 状态: '已完成' },
          { 事项: '数据合规：客户数据需符合所在行业监管要求', 范围: '客户法务负责人', 状态: '已完成' },
          { 事项: '调用规范：开放平台调用需遵守限流与幂等约定', 范围: '客户研发负责人', 状态: '待处理' },
        ],
      },
    ],
  },
  隐私政策: {
    title: '隐私政策',
    subtitle: '我们如何收集、使用与保护你的信息',
    sections: [
      {
        title: '一、收集范围',
        type: 'table',
        columns: [
          { key: '信息类型', title: '信息类型' },
          { key: '用途', title: '使用目的' },
          { key: '保留期', title: '保留期限' },
        ],
        data: [
          { 信息类型: '账号与组织信息', 用途: '身份认证与权限分配', 保留期: '账号存续期间' },
          { 信息类型: '操作日志', 用途: '审计追溯与安全巡检', 保留期: '12 个月' },
          { 信息类型: '业务单据', 用途: '业务流程运转与报表', 保留期: '按租户策略' },
          { 信息类型: '登录设备信息', 用途: '异常登录识别', 保留期: '6 个月' },
        ],
      },
      {
        title: '二、我们如何保护',
        type: 'text',
        text:
          '平台数据传输使用 TLS 1.3 加密，敏感字段（密码、密钥、证件号）在存储层加密并定期轮换；' +
          '所有后台操作留痕，管理员可按租户查看与导出审计日志。租户之间数据物理隔离，不共享任何业务数据。',
      },
      {
        title: '三、你的权利',
        type: 'checklist',
        data: [
          { 事项: '查询与导出：管理员可在用户中心导出个人数据', 范围: '租户管理员', 状态: '已完成' },
          { 事项: '更正与删除：可通过工单申请更正或注销账号', 范围: '账号本人', 状态: '已完成' },
          { 事项: '授权撤回：第三方应用授权可随时在开放平台撤销', 范围: '租户管理员', 状态: '待处理' },
        ],
      },
    ],
  },
  安全白皮书: {
    title: '安全白皮书',
    subtitle: '云枢 CloudHub 安全体系摘要',
    sections: [
      {
        title: '一、纵深防御',
        type: 'kv',
        rows: [
          { label: '网络层', value: 'WAF + DDoS 清洗 + 私有网络隔离' },
          { label: '应用层', value: '统一网关鉴权、租户上下文注入、接口级限流' },
          { label: '数据层', value: '字段级加密、密钥托管服务、定期轮换' },
          { label: '运维层', value: '堡垒机接入、双人复核、变更留痕' },
        ],
      },
      {
        title: '二、合规认证',
        type: 'table',
        columns: [
          { key: 'name', title: '认证 / 标准' },
          { key: 'scope', title: '覆盖范围' },
          { key: 'valid', title: '有效期' },
        ],
        data: [
          { name: 'ISO 27001', scope: '平台与运维体系', valid: '至 2027-03' },
          { name: '等保三级', scope: '核心业务系统', valid: '至 2026-11' },
          { name: '可信云认证', scope: 'SaaS 服务能力', valid: '至 2026-08' },
        ],
      },
      {
        title: '三、应急响应',
        type: 'text',
        text:
          '安全事件按 P1–P4 四级管理，P0/P1 事件由应急小组 15 分钟内响应，' +
          '并在事后 5 个工作日内输出复盘报告（含时间线、根因与改进项）。',
      },
    ],
  },
}

function openAgreement(title: string) {
  const doc = agreements[title]
  if (!doc) return
  ui.openPreview(title, doc)
}
</script>

<template>
  <div class="login-page">
    <!-- ================= 左侧品牌区 ================= -->
    <div class="lp-brand">
      <div class="lp-glow g1" />
      <div class="lp-glow g2" />
      <div class="lp-grid" />

      <div class="lp-brand-inner">
        <div class="lp-logo">
          <svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true">
            <rect width="32" height="32" rx="9" fill="#fff" fill-opacity="0.16" />
            <path d="M9 21V11l7 5 7-5v10" stroke="#fff" stroke-width="2.4" fill="none"
              stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <div>
            <strong>云枢 CloudHub</strong>
            <span>企业一体化管理平台</span>
          </div>
        </div>

        <h1 class="lp-title">CRM · OA · 财务<br />一个平台，三域打通</h1>
        <p class="lp-sub">
          以组织与权限为底座，让销售流程、内部协同与财务核算在同一条数据链路上流转。
        </p>

        <ul class="lp-features">
          <li>
            <span class="lp-feat-ico"><AppIcon name="TeamOutlined" :size="17" /></span>
            <div>
              <strong>线索到回款全周期</strong>
              <em>公海私海、商机看板、合同与回款计划</em>
            </div>
          </li>
          <li>
            <span class="lp-feat-ico"><AppIcon name="ApartmentOutlined" :size="17" /></span>
            <div>
              <strong>审批流与组织一体化</strong>
              <em>BPMN 流程引擎、组织架构、考勤与档案</em>
            </div>
          </li>
          <li>
            <span class="lp-feat-ico"><AppIcon name="BankOutlined" :size="17" /></span>
            <div>
              <strong>多账套财务核算</strong>
              <em>凭证、应收应付、三大报表与期末结账</em>
            </div>
          </li>
        </ul>

        <div class="lp-stats">
          <div><strong>1,286</strong><span>服务企业</span></div>
          <div><strong>99.95%</strong><span>服务可用性</span></div>
          <div><strong>7×24</strong><span>安全审计</span></div>
        </div>
      </div>
    </div>

    <!-- ================= 右侧登录区 ================= -->
    <div class="lp-form-side">
      <div class="lp-form-wrap">
        <header class="lp-form-head">
          <h2>欢迎回来</h2>
          <p>登录云枢，开启今天的工作</p>
        </header>

        <a-form ref="formRef" :model="form" :rules="rules" layout="vertical" @finish="onSubmit">
          <a-form-item label="演示身份" name="identity">
            <a-select
              v-model:value="form.identity"
              :options="identityOptions"
              size="large"
              class="lp-control"
              placeholder="选择演示身份"
              @change="onIdentityChange"
            >
              <template #suffixIcon><AppIcon name="UserSwitchOutlined" :size="14" /></template>
            </a-select>
            <div v-if="currentDemo" class="lp-ident">
              <AppIcon name="IdcardOutlined" :size="13" />
              <span>当前身份：{{ currentDemo.name }} · {{ currentDemo.role }}（{{ currentDemo.dept }}）</span>
            </div>
          </a-form-item>

          <a-form-item label="租户" name="tenant">
            <a-select
              v-model:value="form.tenant"
              :options="tenants"
              size="large"
              class="lp-control"
              @change="onTenantChange"
            >
              <template #suffixIcon><AppIcon name="GoldOutlined" :size="14" /></template>
            </a-select>
          </a-form-item>

          <a-form-item label="账号" name="account">
            <a-input v-model:value="form.account" size="large" placeholder="邮箱 / 手机号 / 工号" class="lp-control">
              <template #prefix><AppIcon name="UserOutlined" :size="15" /></template>
            </a-input>
          </a-form-item>

          <a-form-item label="密码" name="password">
            <a-input-password v-model:value="form.password" size="large" placeholder="请输入密码" class="lp-control">
              <template #prefix><AppIcon name="LockOutlined" :size="15" /></template>
            </a-input-password>
          </a-form-item>

          <div class="lp-row">
            <a-checkbox v-model:checked="form.remember">7 天内免登录</a-checkbox>
            <a class="lp-link" @click="openForgot">忘记密码？</a>
          </div>

          <a-button
            type="primary"
            size="large"
            block
            html-type="submit"
            :loading="loading"
            :disabled="loading"
            class="lp-submit"
          >
            登 录
          </a-button>
        </a-form>

        <div class="lp-divider"><span>其他登录方式</span></div>

        <div class="lp-sso">
          <button
            v-for="c in ssoChannels"
            :key="c.type"
            class="lp-sso-btn"
            :class="{ loading: ssoLoading === c.type }"
            :disabled="!!ssoLoading"
            :title="`将以「${c.name} · ${c.role}」身份登录`"
            @click="sso(c.type)"
          >
            <span v-if="ssoLoading === c.type" class="lp-spin" />
            <AppIcon v-else :name="c.icon" :size="16" />
            {{ c.label }}
          </button>
        </div>
        <p class="lp-sso-tip">
          单点登录将自动完成身份识别；当前演示身份为「{{ currentDemo?.name ?? '未选择' }}」。
        </p>

        <footer class="lp-foot">
          <span>© 2025 云枢科技（云枢 CloudHub）</span>
          <span class="lp-foot-links">
            <a @click="openAgreement('服务协议')">服务协议</a>
            <a @click="openAgreement('隐私政策')">隐私政策</a>
            <a @click="openAgreement('安全白皮书')">安全白皮书</a>
          </span>
        </footer>
      </div>
    </div>

    <!-- ================= 忘记密码 ================= -->
    <a-modal
      v-model:open="pwdOpen"
      title="重置密码"
      :width="420"
      ok-text="确认重置"
      cancel-text="取消"
      :mask-closable="false"
      @ok="submitPwd"
    >
      <a-form ref="pwdFormRef" :model="pwdForm" :rules="pwdRules" layout="vertical">
        <a-form-item label="账号" name="account">
          <a-input v-model:value="pwdForm.account" size="large" placeholder="邮箱 / 手机号 / 工号" allow-clear />
        </a-form-item>
        <a-form-item label="新密码" name="password">
          <a-input-password v-model:value="pwdForm.password" size="large" placeholder="不少于 6 位" />
        </a-form-item>
        <a-form-item label="确认密码" name="confirm">
          <a-input-password v-model:value="pwdForm.confirm" size="large" placeholder="再次输入新密码" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 页脚协议正文：复用全局预览抽屉 -->
    <PreviewDrawer />
  </div>
</template>

<style scoped>
.login-page {
  height: 100vh;
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  background: #fff;
}

/* ---------------- 左侧 ---------------- */
.lp-brand {
  position: relative;
  overflow: hidden;
  background: linear-gradient(140deg, #0a1a3c 0%, #10306e 45%, #165dff 120%);
  color: #fff;
  display: flex;
  align-items: center;
  padding: 0 6%;
}
.lp-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.5;
}
.lp-glow.g1 {
  width: 460px;
  height: 460px;
  background: #2f6bff;
  top: -140px;
  right: -120px;
}
.lp-glow.g2 {
  width: 360px;
  height: 360px;
  background: #00b2a9;
  bottom: -140px;
  left: -80px;
  opacity: 0.28;
}
.lp-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
  background-size: 46px 46px;
  mask-image: radial-gradient(ellipse at 40% 40%, #000 30%, transparent 78%);
}
.lp-brand-inner {
  position: relative;
  z-index: 2;
  max-width: 520px;
}
.lp-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 46px;
}
.lp-logo div {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}
.lp-logo strong {
  font-size: 16px;
  letter-spacing: 0.4px;
}
.lp-logo span {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}
.lp-title {
  font-size: 38px;
  line-height: 1.34;
  font-weight: 600;
  letter-spacing: 0.5px;
  margin: 0 0 18px;
}
.lp-sub {
  font-size: 14.5px;
  line-height: 1.85;
  color: rgba(255, 255, 255, 0.68);
  margin: 0 0 40px;
  max-width: 430px;
}
.lp-features {
  list-style: none;
  padding: 0;
  margin: 0 0 46px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.lp-features li {
  display: flex;
  align-items: flex-start;
  gap: 13px;
}
.lp-feat-ico {
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: var(--r-md);
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
}
.lp-features strong {
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 3px;
}
.lp-features em {
  font-style: normal;
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.55);
}
.lp-stats {
  display: flex;
  gap: 42px;
  padding-top: 26px;
  border-top: 1px solid rgba(255, 255, 255, 0.13);
}
.lp-stats div {
  display: flex;
  flex-direction: column;
}
.lp-stats strong {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0.3px;
}
.lp-stats span {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 3px;
}

/* ---------------- 右侧 ---------------- */
.lp-form-side {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: #fff;
  overflow-y: auto;
}
.lp-form-wrap {
  width: 100%;
  max-width: 380px;
}
.lp-form-head {
  margin-bottom: 30px;
}
.lp-form-head h2 {
  font-size: 25px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--text-1);
  letter-spacing: 0.3px;
}
.lp-form-head p {
  margin: 0;
  color: var(--text-3);
  font-size: 13.5px;
}
.lp-control :deep(.ant-input),
.lp-control :deep(.ant-select-selector) {
  border-radius: var(--r-md);
}
.lp-ident {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 7px;
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.5;
}
.lp-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: -4px 0 22px;
}
.lp-link {
  color: var(--brand-600);
  font-size: 13px;
  cursor: pointer;
}
.lp-link:hover {
  color: var(--brand-700);
}
.lp-submit {
  height: 44px;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 4px;
  border-radius: var(--r-md);
  box-shadow: 0 4px 14px rgba(22, 93, 255, 0.22);
}
.lp-submit:hover {
  box-shadow: 0 6px 20px rgba(22, 93, 255, 0.3);
}
.lp-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 26px 0 18px;
  color: var(--text-4);
  font-size: 12px;
}
.lp-divider::before,
.lp-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}
.lp-sso {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.lp-sso-btn {
  height: 40px;
  border-radius: var(--r-md);
  border: 1px solid var(--border-strong);
  background: #fff;
  color: var(--text-2);
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  font-family: inherit;
  transition: all var(--dur-base) var(--ease);
}
.lp-sso-btn:hover {
  border-color: var(--brand-400);
  color: var(--brand-600);
  background: var(--brand-050);
}
.lp-sso-btn:disabled {
  cursor: not-allowed;
  opacity: 0.72;
}
.lp-sso-btn:disabled:hover {
  border-color: var(--border-strong);
  color: var(--text-2);
  background: #fff;
}
.lp-sso-btn.loading {
  border-color: var(--brand-400);
  color: var(--brand-600);
  background: var(--brand-050);
}
.lp-spin {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--brand-200);
  border-top-color: var(--brand-600);
  animation: lp-rotate 0.7s linear infinite;
}
@keyframes lp-rotate {
  to { transform: rotate(360deg); }
}
.lp-sso-tip {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--text-4);
  text-align: center;
}
.lp-foot {
  margin-top: 32px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: var(--text-4);
}
.lp-foot-links {
  display: flex;
  gap: 16px;
}
.lp-foot a {
  color: var(--text-3);
  cursor: pointer;
}
.lp-foot a:hover {
  color: var(--brand-600);
}

@media (max-width: 1080px) {
  .login-page {
    grid-template-columns: 1fr;
  }
  .lp-brand {
    display: none;
  }
}
</style>
