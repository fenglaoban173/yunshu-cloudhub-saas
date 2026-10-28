import { defineStore } from 'pinia'
import type { AppCode } from '@/config/apps'
import { appList } from '@/config/apps'
import { defaultDemoUser, findDemoUser } from '@/mock/users'

export interface UserInfo {
  name: string
  account: string
  role: string
  dept: string
  avatarText: string
  tenant: string
  tenantPlan: string
}

function profileOf(u: typeof defaultDemoUser): UserInfo {
  return {
    name: u.name,
    account: u.account,
    role: u.role,
    dept: u.dept,
    avatarText: u.avatarText,
    tenant: u.tenant,
    tenantPlan: u.tenantPlan,
  }
}

export const useUserStore = defineStore('user', {
  state: () => {
    // 刷新页面时按上次登录的账号恢复身份与权限
    const demo = findDemoUser(localStorage.getItem('ch_account') || '') ?? defaultDemoUser
    return {
      token: localStorage.getItem('ch_token') || '',
      user: {
        ...profileOf(demo),
        // 手动切换过的租户优先于演示身份的默认租户
        tenant: localStorage.getItem('ch_tenant') || demo.tenant,
      },
      /** 当前用户被授权的应用域（左侧菜单与承接页卡片都按它裁剪） */
      apps: [...demo.apps] as AppCode[],
      /** 当前所在的应用域；由路由守卫根据 route.meta.app 自动同步 */
      currentApp: (localStorage.getItem('ch_app') as AppCode | '') || '',
      /** 上次所在的应用域 —— 登录落地页偏好为「上次所在应用」时用它 */
      lastApp: (localStorage.getItem('ch_last_app') as AppCode | '') || '',
      collapsed: false,
    }
  },
  getters: {
    /** 有权访问的应用元数据（按 appList 顺序） */
    appMetas: (s) => appList.filter((a) => s.apps.includes(a.code)),
    /** 是否被授权访问某个应用域 */
    hasApp: (s) => (code: AppCode) => s.apps.includes(code),
    /** 上次所在应用域的落地路由（无授权或无记录时为空） */
    lastAppEntry: (s) => {
      if (!s.lastApp) return ''
      const meta = appList.find((a) => a.code === s.lastApp)
      return meta && s.apps.includes(meta.code) ? meta.entry : ''
    },
  },
  actions: {
    login(account: string) {
      const demo = findDemoUser(account) ?? defaultDemoUser
      // 登录前先把当前所在应用记为「上次所在应用」，供登录落地页偏好使用
      const prevApp = (localStorage.getItem('ch_app') as AppCode | '') || ''
      if (prevApp) localStorage.setItem('ch_last_app', prevApp)
      this.token = 'mock-' + Date.now()
      this.user = profileOf(demo)
      this.apps = [...demo.apps]
      this.currentApp = ''
      this.lastApp = (localStorage.getItem('ch_last_app') as AppCode | '') || ''
      localStorage.setItem('ch_token', this.token)
      localStorage.setItem('ch_account', demo.account)
      localStorage.removeItem('ch_app')
    },
    logout() {
      this.token = ''
      this.currentApp = ''
      localStorage.removeItem('ch_token')
      localStorage.removeItem('ch_app')
    },
    toggleSidebar() {
      this.collapsed = !this.collapsed
    },
    /** 切换当前应用域 */
    switchApp(code: AppCode) {
      this.currentApp = code
      this.lastApp = code
      localStorage.setItem('ch_app', code)
      localStorage.setItem('ch_last_app', code)
    },
    /** 切换租户：顶栏与门户展示的租户身份随之变化 */
    switchTenant(name: string, plan: string) {
      this.user.tenant = name
      this.user.tenantPlan = plan
      localStorage.setItem('ch_tenant', name)
    },
  },
})
