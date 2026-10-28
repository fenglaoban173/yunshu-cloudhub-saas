<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { menuTree, filterMenuByApps, flattenMenu, type MenuNode } from '@/config/menu'
import { getApp, type AppCode } from '@/config/apps'
import { useUserStore } from '@/stores/user'
import { useTabsStore } from '@/stores/tabs'
import AppIcon from '@/components/AppIcon.vue'
import NoticePanel from '@/components/NoticePanel.vue'
import { useDataStore } from '@/stores/data'
import { useChromeStore } from '@/stores/chrome'

const route = useRoute()
const router = useRouter()
const user = useUserStore()
const tabs = useTabsStore()
const data = useDataStore()
const chrome = useChromeStore()

const openKeys = ref<string[]>([])
const selectedKeys = ref<string[]>([])
const keyword = ref('')
const searchOpen = ref(false)
const noticeOpen = ref(false)

/** 未读消息数：与消息中心实时一致 */
const unreadCount = computed(() => data.rows('message').filter((m: any) => m.read === '未读').length)

/** 打开通知面板：按偏好自动已读 */
watch(noticeOpen, (v) => {
  if (v) chrome.autoMarkRead()
})

/** 有权访问的应用域对应的菜单树 */
const permitted = computed(() => filterMenuByApps(menuTree, user.apps))

const flatRoutes = computed(() => flattenMenu(permitted.value))

/** 当前所在应用域（未进入任何应用时回落到第一个有权应用） */
const activeApp = computed<AppCode>(() => (user.currentApp || user.apps[0] || '') as AppCode)
const activeAppMeta = computed(() => getApp(activeApp.value))

/** 侧栏只展示当前应用域的菜单，公共节点（工作台）始终可见 */
const visibleMenu = computed(() => permitted.value.filter((n) => !n.app || n.app === activeApp.value))

/** 侧栏中以子菜单形式出现的分组 key */
const visibleGroups = computed(() => visibleMenu.value.filter((n) => n.children?.length).map((n) => n.key))

/** 当前路由对应的菜单分组 */
const currentGroup = computed(() => {
  const g = (route.meta as any)?.group
  return typeof g === 'string' && visibleGroups.value.includes(g) ? g : ''
})

const breadcrumb = computed(() => {
  const items: { title: string; path?: string }[] = []
  for (const node of permitted.value) {
    if (node.children?.length) {
      const hit = node.children.find((c) => c.key === route.name)
      if (hit) {
        items.push({ title: node.title, path: node.path })
        items.push({ title: hit.title })
        break
      }
    } else if (node.key === route.name) {
      items.push({ title: node.title })
      break
    }
  }
  return items
})

watch(
  () => route.fullPath,
  () => {
    const key = String(route.name ?? '')
    selectedKeys.value = [key]
    const group = currentGroup.value
    if (group && !openKeys.value.includes(group)) openKeys.value.push(group)
    if (route.meta?.title) tabs.open(route.fullPath, String(route.meta.title))
  },
  { immediate: true },
)

// 换应用时收起旧分组的展开态
watch(activeApp, () => {
  openKeys.value = []
})

function onSelect({ key }: { key: string }) {
  if (key === '__portal') {
    router.push('/portal')
    return
  }
  const node = flatRoutes.value[key]
  if (node) router.push(node.path)
}

/** 切换应用：同步当前应用域 → 清掉其它应用的页签 → 进入该应用落地页 */
function onSwitchApp({ key }: { key: string }) {
  if (key === '__portal') {
    router.push('/portal')
    return
  }
  const app = getApp(key)
  if (!app) return
  user.switchApp(app.code)
  tabs.closeOutside(app.code)
  router.push(app.entry)
}

const searchResults = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return []
  const out: MenuNode[] = []
  for (const group of permitted.value) {
    for (const child of group.children ?? []) {
      if (child.title.toLowerCase().includes(q)) out.push(child)
    }
  }
  return out.slice(0, 8)
})

function logout() {
  user.logout()
  router.push('/login')
}
</script>

<template>
  <a-layout class="app-shell">
    <!-- ================= 侧边栏 ================= -->
    <a-layout-sider
      v-model:collapsed="user.collapsed"
      :width="220"
      :collapsed-width="64"
      :trigger="null"
      collapsible
      class="app-sider"
    >
      <div class="brand" :class="{ collapsed: user.collapsed }" title="返回应用门户" @click="router.push('/portal')">
        <div class="brand-mark">
          <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="#165DFF" />
            <path d="M9 21V11l7 5 7-5v10" stroke="#fff" stroke-width="2.4" fill="none"
              stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <div v-show="!user.collapsed" class="brand-text">
          <strong>云枢 CloudHub</strong>
          <span>企业一体化管理平台</span>
        </div>
      </div>

      <a-menu
        theme="dark"
        mode="inline"
        :selected-keys="selectedKeys"
        v-model:openKeys="openKeys"
        @select="onSelect"
        class="app-menu"
      >
        <!-- 应用门户：回到承接页重新选择系统 -->
        <a-menu-item key="__portal">
          <AppIcon name="AppstoreOutlined" :size="16" />
          <span>应用门户</span>
        </a-menu-item>

        <template v-for="node in visibleMenu" :key="node.key">
          <a-sub-menu v-if="node.children?.length" :key="node.key">
            <template #title>
              <AppIcon :name="node.icon" :size="16" />
              <span>{{ node.title }}</span>
              <a-badge
                v-if="node.badge"
                :count="node.badge"
                :number-style="{ backgroundColor: '#F53F3F', fontSize: '11px', height: '16px', lineHeight: '16px', padding: '0 5px' }"
              />
            </template>
            <a-menu-item v-for="child in node.children" :key="child.key">
              <AppIcon :name="child.icon" :size="15" />
              <span>{{ child.title }}</span>
            </a-menu-item>
          </a-sub-menu>
          <a-menu-item v-else :key="node.key">
            <AppIcon :name="node.icon" :size="16" />
            <span>{{ node.title }}</span>
          </a-menu-item>
        </template>
      </a-menu>
    </a-layout-sider>

    <a-layout>
      <!-- ================= 顶栏 ================= -->
      <a-layout-header class="app-header">
        <div class="hd-left">
          <a-button type="text" class="collapse-btn" @click="user.toggleSidebar()">
            <AppIcon :name="user.collapsed ? 'MenuUnfoldOutlined' : 'MenuFoldOutlined'" :size="18" />
          </a-button>

          <!-- 应用切换器：随时在已授权的应用之间切换 -->
          <a-dropdown placement="bottomLeft" :trigger="['click']">
            <div class="app-switcher" tabindex="0" role="button">
              <span class="as-ico" :style="{ background: activeAppMeta?.color }">
                <AppIcon :name="activeAppMeta?.icon ?? 'AppstoreOutlined'" :size="13" />
              </span>
              <span class="as-name">{{ activeAppMeta?.name ?? '应用门户' }}</span>
              <AppIcon name="DownOutlined" :size="11" class="as-caret" />
            </div>
            <template #overlay>
              <a-menu class="as-menu" @click="onSwitchApp">
                <a-menu-item v-for="a in user.appMetas" :key="a.code">
                  <span class="as-item" :class="{ active: a.code === user.currentApp }">
                    <span class="as-item-ico" :style="{ color: a.color }">
                      <AppIcon :name="a.icon" :size="14" />
                    </span>
                    <span class="as-item-name">{{ a.name }}</span>
                    <AppIcon v-if="a.code === user.currentApp" name="CheckCircleOutlined" :size="13" class="as-item-check" />
                  </span>
                </a-menu-item>
                <a-menu-divider />
                <a-menu-item key="__portal">
                  <span class="as-item">
                    <span class="as-item-ico"><AppIcon name="AppstoreOutlined" :size="14" /></span>
                    <span class="as-item-name">应用门户</span>
                  </span>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>

          <a-breadcrumb class="hd-crumb">
            <a-breadcrumb-item v-for="(b, i) in breadcrumb" :key="i">
              <span :class="{ 'crumb-cur': i === breadcrumb.length - 1 }">{{ b.title }}</span>
            </a-breadcrumb-item>
          </a-breadcrumb>
        </div>

        <div class="hd-right">
          <!-- 全局搜索 -->
          <a-popover
            placement="bottomRight"
            trigger="click"
            :arrow="false"
            v-model:open="searchOpen"
          >
            <template #content>
              <div class="gs-panel">
                <div class="gs-title">搜索菜单</div>
                <a-empty v-if="!searchResults.length" description="无匹配结果" style="padding: 12px 0" />
                <a-menu
                  v-else
                  mode="inline"
                  :style="{ borderInlineEnd: 'none' }"
                  @click="({ key }: any) => { const n = flatRoutes[key]; if (n) { router.push(n.path); keyword = ''; searchOpen = false } }"
                >
                  <a-menu-item v-for="n in searchResults" :key="n.key">
                    <AppIcon :name="n.icon" :size="14" />
                    <span>{{ n.title }}</span>
                  </a-menu-item>
                </a-menu>
              </div>
            </template>
            <a-input
              v-model:value="keyword"
              placeholder="搜索菜单 / 功能"
              allow-clear
              class="gs-input"
              @focus="searchOpen = true"
            >
              <template #prefix><AppIcon name="SearchOutlined" :size="14" /></template>
            </a-input>
          </a-popover>

          <!-- 通知中心：真实未读数 + 消息面板 -->
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
                <a-button type="text" class="hd-icon-btn">
                  <AppIcon name="NotificationOutlined" :size="17" />
                </a-button>
              </a-tooltip>
            </a-badge>
          </a-popover>

          <a-tooltip title="帮助文档">
            <a-button type="text" class="hd-icon-btn" @click="chrome.openDoc('help')">
              <AppIcon name="ReadOutlined" :size="17" />
            </a-button>
          </a-tooltip>

          <a-divider type="vertical" class="hd-divider" />

          <a-dropdown placement="bottomRight">
            <div class="hd-user">
              <a-avatar :size="30" style="background: #165dff">{{ user.user.avatarText }}</a-avatar>
              <div class="hd-user-meta">
                <span class="hd-user-name">{{ user.user.name }}</span>
                <span class="hd-user-role">{{ user.user.role }}</span>
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
                <a-menu-item key="s" @click="chrome.openPrefs()">
                  <AppIcon name="SettingOutlined" :size="14" /> 偏好设置
                </a-menu-item>
                <a-menu-divider />
                <a-menu-item key="logout" danger @click="logout">
                  <AppIcon name="LogoutOutlined" :size="14" /> 退出登录
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </a-layout-header>

      <!-- ================= 页签栏 ================= -->
      <div class="app-tabs">
        <div class="tabs-scroll">
          <div
            v-for="t in tabs.tabs"
            :key="t.path"
            class="tab-item"
            :class="{ active: t.path === tabs.active }"
            @click="router.push(t.path)"
          >
            <span class="tab-title">{{ t.title }}</span>
            <AppIcon
              v-if="t.closable"
              name="CloseOutlined"
              :size="11"
              class="tab-close"
              @click.stop="tabs.close(t.path)"
            />
          </div>
        </div>
        <a-dropdown placement="bottomRight">
          <a-button type="text" size="small" class="tabs-more">
            <AppIcon name="MoreOutlined" :size="14" />
          </a-button>
          <template #overlay>
            <a-menu>
              <a-menu-item key="o" @click="tabs.closeOthers(tabs.active)">关闭其他</a-menu-item>
              <a-menu-item key="a" @click="tabs.closeAll()">关闭全部</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>

      <!-- ================= 内容区 ================= -->
      <!--
        这里不使用 <Transition mode="out-in">：
        out-in 模式需要等待离场动画结束（依赖 rAF / transitionend），
        标签页被浏览器节流时离场回调不会触发，页面会卡在上一屏。
        改为 key 触发重建 + 纯 CSS 入场动画，切换始终即时且不会卡死。
      -->
      <a-layout-content class="app-content">
        <RouterView v-slot="{ Component, route }">
          <component :is="Component" :key="route.path" />
        </RouterView>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<style scoped>
.app-shell {
  height: 100vh;
}

.app-sider {
  background: var(--sidebar-bg) !important;
  box-shadow: 1px 0 0 rgba(255, 255, 255, 0.04);
  z-index: 20;
}

/* ---------- 品牌区 ---------- */
.brand {
  height: var(--header-h);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  overflow: hidden;
  cursor: pointer;
  transition: background-color var(--dur-base) var(--ease);
}
.brand:hover {
  background: rgba(255, 255, 255, 0.04);
}
.brand.collapsed {
  justify-content: center;
  padding: 0;
}
.brand-mark {
  flex: none;
  display: flex;
}
.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  min-width: 0;
}
.brand-text strong {
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.3px;
  white-space: nowrap;
}
.brand-text span {
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
  white-space: nowrap;
}

/* ---------- 菜单 ---------- */
.app-menu {
  background: transparent !important;
  border-inline-end: none !important;
  padding-top: 8px;
}
.app-menu :deep(.ant-menu-item),
.app-menu :deep(.ant-menu-submenu-title) {
  color: rgba(255, 255, 255, 0.72);
}
.app-menu :deep(.ant-menu-item-selected) {
  background: var(--brand-600) !important;
  color: #fff !important;
  font-weight: 500;
}
.app-menu :deep(.ant-menu-item-selected .anticon) {
  color: #fff;
}
.app-menu :deep(.ant-menu-submenu-arrow) {
  color: rgba(255, 255, 255, 0.4);
}

/* ---------- 顶栏 ---------- */
.app-header {
  height: var(--header-h);
  line-height: normal;
  background: #fff;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 0 8px;
  position: sticky;
  top: 0;
  z-index: 15;
}
.hd-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.collapse-btn {
  color: var(--text-2);
  width: 34px;
  height: 34px;
}

/* ---------- 应用切换器 ---------- */
.app-switcher {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  padding: 0 9px 0 6px;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  transition: all var(--dur-base) var(--ease);
}
.app-switcher:hover {
  border-color: var(--brand-400);
  background: var(--brand-050);
}
.as-ico {
  width: 22px;
  height: 22px;
  border-radius: var(--r-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex: none;
}
.as-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-1);
  white-space: nowrap;
}
.as-caret {
  color: var(--text-3);
}
.as-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 168px;
}
.as-item-ico {
  display: inline-flex;
  align-items: center;
  color: var(--text-2);
}
.as-item-name {
  flex: 1;
}
.as-item-check {
  color: var(--brand-600);
}
.as-item.active .as-item-name {
  color: var(--brand-600);
  font-weight: 500;
}
.hd-crumb {
  font-size: 13px;
}
.crumb-cur {
  color: var(--text-1);
  font-weight: 500;
}
.hd-right {
  display: flex;
  align-items: center;
  gap: 4px;
}
.gs-input {
  width: 190px;
  border-radius: var(--r-md);
}
.hd-icon-btn {
  color: var(--text-2);
  width: 34px;
  height: 34px;
}
.hd-divider {
  height: 18px;
  margin: 0 6px;
}
.hd-user {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: var(--r-md);
  cursor: pointer;
  transition: background-color var(--dur-base) var(--ease);
}
.hd-user:hover {
  background: var(--surface-sunken);
}
.hd-user-meta {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}
.hd-user-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-1);
}
.hd-user-role {
  font-size: 11px;
  color: var(--text-3);
}
.gs-panel {
  width: 240px;
  padding: 4px;
}
.gs-title {
  font-size: 12px;
  color: var(--text-3);
  padding: 6px 10px 4px;
}

/* ---------- 页签 ---------- */
.app-tabs {
  height: var(--tabs-h);
  background: #fff;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 8px 0 12px;
  gap: 6px;
  overflow: hidden;
}
.tabs-scroll {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  flex: 1;
}
.tabs-scroll::-webkit-scrollbar {
  display: none;
}
.tab-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 8px 0 10px;
  border-radius: var(--r-sm);
  font-size: 12.5px;
  color: var(--text-2);
  background: var(--surface-sunken);
  border: 1px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--dur-base) var(--ease);
}
.tab-item:hover {
  color: var(--text-1);
  background: #eef0f3;
}
.tab-item.active {
  color: var(--brand-600);
  background: var(--brand-050);
  border-color: var(--brand-100);
  font-weight: 500;
}
.tab-close {
  opacity: 0.5;
  border-radius: 50%;
  padding: 1px;
}
.tab-close:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.08);
}
.tabs-more {
  color: var(--text-3);
}

/* ---------- 内容 ---------- */
.app-content {
  overflow: auto;
  background: var(--surface-sunken);
}
</style>
