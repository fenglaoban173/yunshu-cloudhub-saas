import { defineStore } from 'pinia'
import { appOfPath } from '@/config/menu'
import type { AppCode } from '@/config/apps'

export interface TabItem {
  path: string
  title: string
  closable: boolean
}

export const useTabsStore = defineStore('tabs', {
  state: () => ({
    tabs: [] as TabItem[],
    active: '',
  }),
  actions: {
    open(path: string, title: string) {
      if (!this.tabs.find((t) => t.path === path)) {
        this.tabs.push({ path, title, closable: true })
      }
      this.active = path
    },
    close(path: string) {
      const idx = this.tabs.findIndex((t) => t.path === path)
      if (idx > -1) this.tabs.splice(idx, 1)
      if (this.active === path) {
        const next = this.tabs[Math.max(0, idx - 1)]
        this.active = next?.path ?? ''
      }
    },
    closeOthers(path: string) {
      this.tabs = this.tabs.filter((t) => t.path === path)
      this.active = path
    },
    closeAll() {
      this.tabs = []
      this.active = ''
    },
    /**
     * 切换应用时调用：关闭其它应用域的页签。
     * 公共页签（工作台等，不属于任何应用域）保留。
     */
    closeOutside(app: AppCode) {
      const keep = (p: string) => {
        const owner = appOfPath(p)
        return owner === '' || owner === app
      }
      this.tabs = this.tabs.filter((t) => keep(t.path))
      if (this.active && !keep(this.active)) {
        this.active = this.tabs.length ? this.tabs[this.tabs.length - 1].path : ''
      }
    },
  },
})
