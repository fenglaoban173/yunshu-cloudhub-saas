<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { ColumnsType } from 'ant-design-vue/es/table'
import AppIcon from '@/components/AppIcon.vue'
import NoticePanel from '@/components/NoticePanel.vue'
import { useUserStore } from '@/stores/user'
import { useTabsStore } from '@/stores/tabs'
import { useDataStore } from '@/stores/data'
import { useChromeStore } from '@/stores/chrome'
import { usePortal } from '@/composables/usePortal'
import { getApp, type AppCode, type AppMeta } from '@/config/apps'
import { portalRecent } from '@/mock/portal'

const router = useRouter()
const user = useUserStore()
const tabs = useTabsStore()
const data = useDataStore()
const chrome = useChromeStore()
const { tasks: allTasks, summary, appStats } = usePortal()

/** 当前用户有权限的应用（按 appList 顺序） */
const apps = computed<AppMeta[]>(() => user.appMetas)

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

/** 门户上的待办只展示当前角色有权访问的应用 */
const tasks = computed(() => allTasks.value.filter((t) => user.hasApp(t.app)))

/** 最近访问同样按权限过滤 */
const recent = computed(() => portalRecent.filter((r) => user.hasApp(r.app)))

/** 未读消息数与通知面板 */
const noticeOpen = ref(false)
const unreadCount = computed(() => data.rows('message').filter((m: any) => m.read === '未读').length)
watch(noticeOpen, (v) => {
  if (v) chrome.autoMarkRead()
})

function statsOf(code: AppCode) {
  return appStats.value[code] ?? []
}

/** 取应用配色，取不到时回落到主色 */
function appColor(code: AppCode) {
  return getApp(code)?.color ?? '#165DFF'
}

/** 取应用图标，取不到时回落到通用图标 */
function appIcon(code: AppCode) {
  return getApp(code)?.icon ?? 'AppstoreOutlined'
}

/** 进入某个应用：切换应用域 → 清掉其它应用的页签 → 跳到落地页 */
function enter(app: AppMeta) {
  user.switchApp(app.code)
  tabs.closeOutside(app.code)
  router.push(app.entry)
}

/** 从待办直接跳到对应应用的具体页面 */
function openTask(path: string) {
  const code = (path.split('/')[1] || '') as AppCode
  const app = getApp(code)
  if (app) {
    user.switchApp(app.code)
    tabs.closeOutside(app.code)
  }
  router.push(path)
}

function logout() {
  user.logout()
  router.push('/login')
}

const columns: ColumnsType<any> = [
  { title: '类型', dataIndex: 'appName', key: 'appName', width: 132 },
  { title: '事项', dataIndex: 'title', key: 'title' },
  { title: '来源', dataIndex: 'from', key: 'from', width: 190, ellipsis: true },
  { title: '金额', dataIndex: 'amount', key: 'amount', width: 130, align: 'right' },
  { title: '时效', dataIndex: 'time', key: 'time', width: 168 },
  { title: '操作', key: 'action', width: 96, align: 'right' },
]
</script>

<template>
  <div class="portal">
    <!-- ================= 顶部栏 ================= -->
    <header class="pl-header">
      <div class="pl-brand">
        <div class="pl-brand-mark">
          <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="#165DFF" />
            <path d="M9 21V11l7 5 7-5v10" stroke="#fff" stroke-width="2.4" fill="none"
              stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <div class="pl-brand-text">
          <strong>云枢 CloudHub</strong>
          <span>企业一体化管理平台</span>
        </div>
      </div>

      <div class="pl-header-right">
        <span class="pl-tenant">
          <AppIcon name="GoldOutlined" :size="13" />
          {{ user.user.tenant }} · {{ user.user.tenantPlan }}
        </span>

        <a-popover
          placement="bottomRight"
          trigger="click"
          :arrow="false"
          v-model:open="noticeOpen"
        >
          <template #content>
            <NoticePanel />
          </template>
          <a-badge :count="unreadCount" size="small" :offset="[-2, 4]">
            <a-tooltip title="通知中心">
              <a-button type="text" class="pl-icon-btn">
                <AppIcon name="NotificationOutlined" :size="17" />
              </a-button>
            </a-tooltip>
          </a-badge>
        </a-popover>

        <a-divider type="vertical" class="pl-divider" />

        <a-dropdown placement="bottomRight">
          <div class="pl-user">
            <a-avatar :size="30" style="background: #165dff">{{ user.user.avatarText }}</a-avatar>
            <div class="pl-user-meta">
              <span class="pl-user-name">{{ user.user.name }}</span>
              <span class="pl-user-role">{{ user.user.role }}</span>
            </div>
            <AppIcon name="DownOutlined" :size="12" class="text-3" />
          </div>
          <template #overlay>
            <a-menu>
              <a-menu-item key="p" @click="chrome.openProfile()">
                <AppIcon name="UserOutlined" :size="14" /> 个人中心
              </a-menu-item>
              <a-menu-item key="t" @click="chrome.openTenant()">
                <AppIcon name="GoldOutlined" :size="14" /> 切换租户
              </a-menu-item>
              <a-menu-divider />
              <a-menu-item key="logout" danger @click="logout">
                <AppIcon name="LogoutOutlined" :size="14" /> 退出登录
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </header>

    <!-- ================= Hero ================= -->
    <section class="pl-hero">
      <div class="pl-glow g1" />
      <div class="pl-glow g2" />
      <div class="pl-grid" />
      <div class="pl-hero-inner">
        <div class="pl-hero-text">
          <h1>{{ greeting }}，{{ user.user.name }}</h1>
          <p>
            {{ user.user.dept }} · {{ user.user.role }}
            <span class="pl-dot" />
            当前角色已开通 <strong>{{ apps.length }}</strong> 个应用
          </p>
        </div>
        <div class="pl-hero-stats">
          <div v-for="s in summary" :key="s.label" class="pl-hero-stat">
            <strong>{{ s.value }}<em>{{ s.unit }}</em></strong>
            <span>{{ s.label }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ================= 主体 ================= -->
    <main class="pl-body">
      <!-- ---------- 应用选择 ---------- -->
      <section class="pl-section">
        <div class="pl-sec-head">
          <h2>选择要进入的系统</h2>
          <span class="pl-sec-note">按角色授权展示，未开通的应用不会出现</span>
        </div>

        <div v-if="apps.length" class="pl-grid-cards">
          <article
            v-for="a in apps"
            :key="a.code"
            class="pl-card"
            role="link"
            tabindex="0"
            @click="enter(a)"
            @keydown.enter="enter(a)"
            @keydown.space.prevent="enter(a)"
          >
            <div class="pl-card-head">
              <span
                class="pl-card-ico"
                :style="{ color: a.color, background: `${a.color}14`, borderColor: `${a.color}33` }"
              >
                <AppIcon :name="a.icon" :size="20" />
              </span>
              <span class="pl-card-count">{{ a.modules }} 项功能</span>
            </div>

            <h3 class="pl-card-title">
              {{ a.name }}
              <span v-if="user.currentApp === a.code" class="pl-card-last">上次使用</span>
            </h3>
            <p class="pl-card-desc">{{ a.desc }}</p>

            <div class="pl-card-stats">
              <div v-for="s in statsOf(a.code)" :key="s.label" class="pl-stat">
                <strong>{{ s.value }}</strong>
                <span>{{ s.label }}</span>
              </div>
            </div>

            <div class="pl-card-go">
              进入系统 <AppIcon name="RightOutlined" :size="11" />
            </div>
          </article>
        </div>

        <a-empty v-else description="当前角色尚未开通任何应用，请联系管理员授权" class="pl-empty" />
      </section>

      <!-- ---------- 待我处理 ---------- -->
      <section v-if="tasks.length" class="pl-section">
        <div class="pl-sec-head">
          <h2>待我处理</h2>
          <span class="pl-sec-note">跨应用聚合 · {{ tasks.length }} 项</span>
        </div>
        <div class="pl-table-wrap">
          <a-table
            :columns="columns"
            :data-source="tasks"
            row-key="id"
            :pagination="false"
            size="middle"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'appName'">
                <span class="pl-tag" :style="{ color: appColor(record.app), background: `${appColor(record.app)}14` }">
                  {{ record.appName }}
                </span>
              </template>
              <template v-else-if="column.key === 'title'">
                <span class="pl-task-title">{{ record.title }}</span>
              </template>
              <template v-else-if="column.key === 'amount'">
                <span class="pl-amount">{{ record.amount ?? '—' }}</span>
              </template>
              <template v-else-if="column.key === 'time'">
                <span class="pl-time">
                  {{ record.time }}
                  <a-tag
                    v-if="record.urgency !== '普通'"
                    :color="record.urgency === '特急' ? 'error' : 'warning'"
                    class="pl-urgency"
                  >
                    {{ record.urgency }}
                  </a-tag>
                </span>
              </template>
              <template v-else-if="column.key === 'action'">
                <a class="pl-link" @click="openTask(record.path)">处理</a>
              </template>
            </template>
          </a-table>
        </div>
      </section>

      <!-- ---------- 最近访问 ---------- -->
      <section v-if="recent.length" class="pl-section">
        <div class="pl-sec-head">
          <h2>最近访问</h2>
        </div>
        <div class="pl-recent">
          <button
            v-for="r in recent"
            :key="r.path"
            class="pl-chip"
            type="button"
            @click="openTask(r.path)"
          >
            <AppIcon :name="appIcon(r.app)" :size="13" />
            {{ r.label }}
          </button>
        </div>
      </section>
    </main>

    <footer class="pl-foot">
      <span>© 2025 云枢科技（云枢 CloudHub）</span>
      <span class="pl-foot-links">
        <a @click="chrome.openDoc('service')">服务协议</a>
        <a @click="chrome.openDoc('privacy')">隐私政策</a>
        <a @click="chrome.openDoc('security')">安全白皮书</a>
      </span>
    </footer>
  </div>
</template>

<style scoped>
.portal {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--surface-sunken);
}

/* ---------------- 顶部栏 ---------------- */
.pl-header {
  height: 60px;
  flex: none;
  background: #fff;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}
.pl-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pl-brand-mark {
  display: flex;
}
.pl-brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}
.pl-brand-text strong {
  font-size: 14.5px;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: var(--text-1);
}
.pl-brand-text span {
  font-size: 11px;
  color: var(--text-4);
}
.pl-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}
.pl-tenant {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border-radius: var(--r-md);
  background: var(--surface-sunken);
  border: 1px solid var(--border);
  color: var(--text-2);
  font-size: 12.5px;
}
.pl-icon-btn {
  color: var(--text-2);
  width: 34px;
  height: 34px;
}
.pl-divider {
  height: 18px;
  margin: 0 6px;
}
.pl-user {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: var(--r-md);
  cursor: pointer;
  transition: background-color var(--dur-base) var(--ease);
}
.pl-user:hover {
  background: var(--surface-sunken);
}
.pl-user-meta {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}
.pl-user-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-1);
}
.pl-user-role {
  font-size: 11px;
  color: var(--text-3);
}

/* ---------------- Hero ---------------- */
.pl-hero {
  position: relative;
  overflow: hidden;
  flex: none;
  background: linear-gradient(140deg, #0a1a3c 0%, #10306e 48%, #165dff 125%);
  color: #fff;
}
.pl-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.5;
}
.pl-glow.g1 {
  width: 420px;
  height: 420px;
  background: #2f6bff;
  top: -160px;
  right: -100px;
}
.pl-glow.g2 {
  width: 320px;
  height: 320px;
  background: #00b2a9;
  bottom: -150px;
  left: 8%;
  opacity: 0.24;
}
.pl-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 46px 46px;
  mask-image: radial-gradient(ellipse at 30% 30%, #000 25%, transparent 76%);
}
.pl-hero-inner {
  position: relative;
  z-index: 2;
  max-width: 1240px;
  margin: 0 auto;
  padding: 38px 24px 42px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 32px;
  flex-wrap: wrap;
}
.pl-hero-text h1 {
  margin: 0 0 10px;
  font-size: 30px;
  font-weight: 600;
  letter-spacing: 0.5px;
  line-height: 1.3;
}
.pl-hero-text p {
  margin: 0;
  font-size: 13.5px;
  color: rgba(255, 255, 255, 0.68);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.pl-hero-text p strong {
  color: #fff;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.pl-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
}
.pl-hero-stats {
  display: flex;
  gap: 40px;
}
.pl-hero-stat {
  display: flex;
  flex-direction: column;
}
.pl-hero-stat strong {
  font-size: 26px;
  font-weight: 600;
  letter-spacing: 0.3px;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}
.pl-hero-stat em {
  font-style: normal;
  font-size: 12px;
  font-weight: 400;
  margin-left: 3px;
  color: rgba(255, 255, 255, 0.6);
}
.pl-hero-stat span {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 4px;
}

/* ---------------- 主体 ---------------- */
.pl-body {
  flex: 1;
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 28px 24px 12px;
}
.pl-section {
  margin-bottom: 28px;
}
.pl-sec-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.pl-sec-head h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-1);
  letter-spacing: 0.2px;
}
.pl-sec-note {
  font-size: 12.5px;
  color: var(--text-3);
}

/* ---------------- 应用卡片 ---------------- */
.pl-grid-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.pl-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 20px;
  cursor: pointer;
  box-shadow: var(--shadow-card);
  transition:
    transform var(--dur-base) var(--ease),
    box-shadow var(--dur-base) var(--ease),
    border-color var(--dur-base) var(--ease);
}
.pl-card:hover,
.pl-card:focus-visible {
  transform: translateY(-2px);
  border-color: var(--brand-200);
  box-shadow: 0 8px 24px rgba(29, 35, 41, 0.09);
  outline: none;
}
.pl-card:focus-visible {
  border-color: var(--brand-500);
  box-shadow: 0 0 0 3px rgba(22, 93, 255, 0.14);
}
.pl-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.pl-card-ico {
  width: 40px;
  height: 40px;
  border-radius: var(--r-lg);
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.pl-card-count {
  font-size: 11.5px;
  color: var(--text-3);
  background: var(--surface-sunken);
  border-radius: var(--r-sm);
  padding: 2px 7px;
  font-variant-numeric: tabular-nums;
}
.pl-card-title {
  margin: 0 0 6px;
  font-size: 15.5px;
  font-weight: 600;
  color: var(--text-1);
  display: flex;
  align-items: center;
  gap: 8px;
}
.pl-card-last {
  font-size: 11px;
  font-weight: 400;
  color: var(--brand-600);
  background: var(--brand-050);
  border: 1px solid var(--brand-100);
  border-radius: var(--r-sm);
  padding: 1px 6px;
}
.pl-card-desc {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.6;
  min-height: 42px;
}
.pl-card-stats {
  display: flex;
  gap: 20px;
  padding-top: 14px;
  border-top: 1px solid var(--border-subtle);
}
.pl-stat {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.pl-stat strong {
  font-size: 19px;
  font-weight: 600;
  color: var(--text-1);
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.pl-stat span {
  font-size: 11.5px;
  color: var(--text-3);
  margin-top: 2px;
  white-space: nowrap;
}
.pl-card-go {
  margin-top: 14px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--brand-600);
  font-weight: 500;
}
.pl-card:hover .pl-card-go {
  color: var(--brand-700);
}
.pl-empty {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 48px 0;
}

/* ---------------- 待办表格 ---------------- */
.pl-table-wrap {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}
.pl-tag {
  display: inline-block;
  font-size: 11.5px;
  padding: 2px 8px;
  border-radius: var(--r-sm);
  white-space: nowrap;
}
.pl-task-title {
  color: var(--text-1);
  font-weight: 500;
}
.pl-amount {
  font-variant-numeric: tabular-nums;
  color: var(--text-1);
  font-weight: 500;
}
.pl-time {
  font-size: 13px;
  color: var(--text-2);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.pl-urgency {
  margin: 0;
}
.pl-link {
  color: var(--brand-600);
  font-size: 13px;
  cursor: pointer;
}
.pl-link:hover {
  color: var(--brand-700);
}

/* ---------------- 最近访问 ---------------- */
.pl-recent {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.pl-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--dur-base) var(--ease);
}
.pl-chip:hover {
  border-color: var(--brand-400);
  color: var(--brand-600);
  background: var(--brand-050);
}

/* ---------------- 页脚 ---------------- */
.pl-foot {
  flex: none;
  max-width: 1240px;
  width: 100%;
  margin: 0 auto;
  padding: 16px 24px 26px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-4);
}
.pl-foot-links {
  display: flex;
  gap: 16px;
}
.pl-foot a {
  color: var(--text-3);
  cursor: pointer;
}
.pl-foot a:hover {
  color: var(--brand-600);
}

/* ---------------- 响应式 ---------------- */
@media (max-width: 1080px) {
  .pl-grid-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .pl-hero-stats {
    gap: 28px;
  }
}
@media (max-width: 720px) {
  .pl-grid-cards {
    grid-template-columns: minmax(0, 1fr);
  }
  .pl-tenant {
    display: none;
  }
  .pl-hero-text h1 {
    font-size: 24px;
  }
  .pl-user-meta {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .pl-card,
  .pl-card:hover,
  .pl-card:focus-visible {
    transform: none;
    transition: none;
  }
}
</style>
