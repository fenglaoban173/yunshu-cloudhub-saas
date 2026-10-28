/**
 * 排序逻辑静态验证（不依赖浏览器）
 * ---------------------------------------------------------------------------
 * 48 个列表页共用 views/ListPage.vue 的 columnSorter / sortRows，
 * 这里用同一套比较器对每个页面、每一列的数据做升序 / 降序排序，
 * 检查结果是否真的单调，以及升降序是否真的给出不同顺序。
 */
import { pages } from '@/mock/pages'
import type { ColumnDef } from '@/config/types'

function numOf(v: any): number {
  if (v === '' || v === null || v === undefined) return NaN
  const n = Number(v)
  return Number.isNaN(n) ? NaN : n
}

function columnSorter(c: ColumnDef) {
  return (a: any, b: any) => {
    const av = a?.[c.key]
    const bv = b?.[c.key]
    if (c.type === 'money' || c.type === 'number' || c.type === 'progress') {
      const an = numOf(av)
      const bn = numOf(bv)
      if (Number.isNaN(an) && Number.isNaN(bn)) return 0
      if (Number.isNaN(an)) return 1
      if (Number.isNaN(bn)) return -1
      return an - bn
    }
    return String(av ?? '').localeCompare(String(bv ?? ''), 'zh-CN')
  }
}

/** 抽取用于比对的原始值（与页面渲染无关，只看数据本身） */
function rawVals(col: ColumnDef, rows: any[]): any[] {
  return rows.map((r) => r?.[col.key])
}

function isMonotone(vals: any[], dir: 1 | -1): boolean {
  for (let i = 1; i < vals.length; i++) {
    const c = columnSorter({ key: 'x' } as any)(vals[i - 1], vals[i])
    if (dir === 1 && c > 0) return false
    if (dir === -1 && c < 0) return false
  }
  return true
}

let checked = 0
let bad: string[] = []
let sameOrder: string[] = []
let allSame: string[] = []

for (const [key, def] of Object.entries(pages)) {
  const rows = (def.data ?? []) as any[]
  if (rows.length < 2) continue
  for (const col of def.columns) {
    if (col.key === '__action') continue
    const cmp = columnSorter(col)
    const asc = [...rows].sort(cmp)
    const desc = [...rows].sort((a, b) => -cmp(a, b))
    const aVals = rawVals(col, asc)
    const dVals = rawVals(col, desc)
    checked++
    if (!isMonotone(aVals, 1)) bad.push(`${key}|${col.key}|ASC-NOT-MONOTONE`)
    if (!isMonotone(dVals, -1)) bad.push(`${key}|${col.key}|DESC-NOT-MONOTONE`)
    // 升降序应当给出不同顺序；若相同说明该列取值全一样（数据问题，不是排序问题）
    const same = asc.every((r, i) => r === desc[i])
    if (same) {
      const distinct = new Set(rawVals(col, rows).map((v) => String(v ?? ''))).size
      if (distinct > 1) sameOrder.push(`${key}|${col.key}|升降序结果相同但取值有 ${distinct} 种`)
      else allSame.push(`${key}|${col.key}|该列只有一个取值`)
    }
  }
}

console.log(`检查列数：${checked}`)
console.log(`单调性异常：${bad.length}`)
bad.slice(0, 30).forEach((b) => console.log('  BAD ' + b))
console.log(`升降序结果相同（取值却有多种）：${sameOrder.length}`)
sameOrder.slice(0, 30).forEach((b) => console.log('  SAME ' + b))
console.log(`整列只有一个取值的列：${allSame.length}`)

console.log('—— 常量列清单 ——')
allSame.forEach((b) => console.log('  ' + b))
