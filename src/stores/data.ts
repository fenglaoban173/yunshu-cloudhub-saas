import { defineStore } from 'pinia'
import { pages } from '@/mock/pages'
import type { ColumnDef } from '@/config/types'

function clone<T>(v: T): T {
  if (typeof structuredClone === 'function') return structuredClone(v)
  return JSON.parse(JSON.stringify(v)) as T
}

/** 字段默认值：按列类型给出一条「空记录」的合理初始值 */
function defaultFor(col: ColumnDef): any {
  if (col.type === 'money' || col.type === 'number' || col.type === 'progress') return 0
  if (col.type === 'tag') {
    const map = col.statusMap ?? {}
    const keys = Object.keys(map)
    // 优先落在「待处理」类状态上（灰 / 橙 / 蓝），避免新建出来就是「已完成」
    const pending = keys.find((k) => ['default', 'warning', 'processing'].includes(map[k].color))
    return pending ?? keys[0] ?? ''
  }
  return ''
}

/**
 * 全局数据仓库
 * ---------------------------------------------------------------------------
 * 48 个列表页的数据源。初始值从 `mock/pages.ts` 深拷贝而来（不污染 Mock 源），
 * 之后页面上的一切增删改都落在仓库里 —— 新建的客户、审批通过的申请、导出的文件
 * 都是真实生效的，而不是弹个 toast 就没了。
 *
 * 刷新页面即重置为初始 Mock 数据（演示项目无后端）。
 */
export const useDataStore = defineStore('data', {
  state: () => {
    const records: Record<string, any[]> = {}
    for (const [key, def] of Object.entries(pages)) {
      records[key] = clone(def.data ?? [])
    }
    return { records }
  },
  getters: {
    /** 取某个页面的全部记录（响应式） */
    rows: (s) => (key: string) => s.records[key] ?? [],
    /** 记录总数 */
    count: (s) => (key: string) => (s.records[key] ?? []).length,
  },
  actions: {
    /** 生成新编号：沿用该页既有的前缀与位数，如 CU00039 */
    nextId(key: string) {
      const rows = this.records[key] ?? []
      const sample = rows[0]?.id ?? rows[0]?.code ?? ''
      const m = String(sample).match(/^([A-Za-z]*)(\d+)$/)
      if (!m) return this.uniqueKey(key, `ID${String(Date.now()).slice(-6)}`)
      const [, prefix, digits] = m
      let max = 0
      for (const r of rows) {
        const mm = String(r.id ?? r.code ?? '').match(/^([A-Za-z]*)(\d+)$/)
        if (mm && mm[1] === prefix) max = Math.max(max, Number(mm[2]))
      }
      return this.uniqueKey(key, prefix + String(max + 1).padStart(digits.length, '0'))
    },

    /**
     * 生成新「编码」：会计科目、凭证这类以 code 作主键的页面，
     * 要沿用既有编码的格式续号（记-0039 / 6603），而不是塞一个随机 id。
     */
    nextCode(key: string) {
      const rows = this.records[key] ?? []
      const sample = String(rows[0]?.code ?? '')
      const m = sample.match(/^(.*?)(\d+)$/)
      if (!m) return this.nextId(key)
      const [, prefix, digits] = m
      let max = 0
      for (const r of rows) {
        const mm = String(r.code ?? '').match(/^(.*?)(\d+)$/)
        if (mm && mm[1] === prefix) max = Math.max(max, Number(mm[2]))
      }
      return this.uniqueKey(key, prefix + String(max + 1).padStart(digits.length, '0'))
    },

    /** 兜底：编号与现有记录撞车时继续往后加，避免出现重复主键 */
    uniqueKey(key: string, seed: string) {
      const used = new Set((this.records[key] ?? []).map((r: any) => String(r.id ?? r.code ?? '')))
      let out = seed
      let n = 1
      while (used.has(out)) {
        n++
        out = seed.replace(/(\d+)$/, (d) => String(Number(d) + n - 1).padStart(d.length, '0'))
      }
      return out
    },

    /** 依据页面定义生成一条空白记录（表单默认值） */
    blankRow(key: string) {
      const def = pages[key]
      const row: Record<string, any> = {}
      if (!def) return row
      for (const c of def.columns) {
        if (c.key === 'id') continue
        row[c.key] = defaultFor(c)
      }
      return row
    },

    /** 新增一条记录，返回最终记录 */
    addRow(key: string, payload: Record<string, any>) {
      const rows = this.records[key] ?? (this.records[key] = [])
      const row: Record<string, any> = { ...this.blankRow(key), ...payload }
      if (!row.id && !row.code) {
        // 以「编码」作主键的页面（会计科目、凭证）续编码，其余页面续 id
        if (pages[key]?.columns[0]?.key === 'code') row.code = this.nextCode(key)
        else row.id = this.nextId(key)
      }
      rows.unshift(row)
      return row
    },

    /** 批量追加 */
    addRows(key: string, payloads: Record<string, any>[]) {
      return payloads.map((p) => this.addRow(key, p))
    },

    /** 更新一条记录 */
    updateRow(key: string, id: any, patch: Record<string, any>) {
      const rows = this.records[key] ?? []
      const idx = rows.findIndex((r) => r.id === id || r.code === id)
      if (idx < 0) return null
      rows[idx] = { ...rows[idx], ...patch }
      return rows[idx]
    },

    /** 批量更新 */
    patchRows(key: string, ids: any[], patch: Record<string, any>) {
      const rows = this.records[key] ?? []
      let n = 0
      for (const r of rows) {
        // 有的页面以 code 作主键（会计科目），两种都要认
        if (ids.includes(r.id ?? r.code)) {
          Object.assign(r, patch)
          n++
        }
      }
      return n
    },

    /** 删除记录 */
    removeRows(key: string, ids: any[]) {
      const rows = this.records[key] ?? []
      const before = rows.length
      this.records[key] = rows.filter((r) => !ids.includes(r.id ?? r.code))
      return before - this.records[key].length
    },
  },
})
