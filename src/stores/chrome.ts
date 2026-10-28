import { defineStore } from 'pinia'
import { docs } from '@/utils/docs'
import { useDataStore } from '@/stores/data'

/**
 * 全局「外壳」交互状态
 * ---------------------------------------------------------------------------
 * 顶栏的通知铃铛、个人中心、切换租户、偏好设置、帮助文档，
 * 以及门户页脚的协议链接 —— 都是跨页面复用的浮层，统一挂在一个 store 里，
 * 任何页面都能打开同一份。
 */

export type Density = 'compact' | 'default' | 'relaxed'
export type Landing = 'portal' | 'last'

const PREFS_KEY = 'ch_prefs'

function loadPrefs(): { density: Density; autoRead: boolean; landing: Landing } {
  const fallback = { density: 'default' as Density, autoRead: false, landing: 'portal' as Landing }
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return fallback
    const p = JSON.parse(raw) ?? {}
    const density = ['compact', 'default', 'relaxed'].includes(p.density) ? p.density : 'default'
    const landing = p.landing === 'last' ? 'last' : 'portal'
    return { density, autoRead: !!p.autoRead, landing }
  } catch {
    // 本地存储损坏时退回默认值，不阻断启动
    return fallback
  }
}

export const useChromeStore = defineStore('chrome', {
  state: () => ({
    /** 通知面板 */
    noticeOpen: false,
    /** 个人中心 */
    profileOpen: false,
    /** 切换租户 */
    tenantOpen: false,
    /** 偏好设置 */
    prefsOpen: false,
    /** 文档弹窗（帮助 / 协议 / 白皮书） */
    docOpen: false,
    docKey: 'help',
    prefs: loadPrefs(),
  }),
  getters: {
    /** 当前文档定义 */
    doc: (s) => docs[s.docKey],
  },
  actions: {
    openNotice() {
      this.noticeOpen = true
    },
    closeNotice() {
      this.noticeOpen = false
    },
    openProfile() {
      this.profileOpen = true
    },
    closeProfile() {
      this.profileOpen = false
    },
    openTenant() {
      this.tenantOpen = true
    },
    closeTenant() {
      this.tenantOpen = false
    },
    openPrefs() {
      this.prefsOpen = true
    },
    closePrefs() {
      this.prefsOpen = false
    },
    openDoc(key: string) {
      this.docKey = key
      this.docOpen = true
    },
    closeDoc() {
      this.docOpen = false
    },
    /** 表格密度 —— 立即生效并落盘 */
    setDensity(d: Density) {
      this.prefs.density = d
      this.persist()
      this.applyDensity()
    },
    setAutoRead(v: boolean) {
      this.prefs.autoRead = v
      this.persist()
    },
    setLanding(v: Landing) {
      this.prefs.landing = v
      this.persist()
    },
    persist() {
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs))
      } catch {
        // 隐私模式下写入可能失败，忽略即可
      }
    },
    /** 把密度写到根节点，由 CSS 变量接管表格行高 */
    applyDensity() {
      document.documentElement.dataset.density = this.prefs.density
    },
    /**
     * 打开通知面板时按偏好自动已读。
     * 未读徽标、消息中心列表会同步变化。
     */
    autoMarkRead() {
      if (!this.prefs.autoRead) return 0
      const data = useDataStore()
      const ids = data
        .rows('message')
        .filter((m: any) => m.read === '未读')
        .map((m: any) => m.id)
      if (!ids.length) return 0
      data.patchRows('message', ids, { read: '已读' })
      return ids.length
    },
  },
})
