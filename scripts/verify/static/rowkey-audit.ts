import { pages } from '@/mock/pages'

let bad = 0
for (const [key, def] of Object.entries(pages)) {
  const rows = def.data ?? []
  if (!rows.length) continue
  const first = rows[0] as any
  const hasId = first.id !== undefined && first.id !== null && first.id !== ''
  const hasCode = first.code !== undefined && first.code !== null && first.code !== ''
  if (!hasId && !hasCode) {
    bad++
    console.log('NO-KEY', key, '| cols:', def.columns.map((c) => c.key).join(','))
    continue
  }
  const keyOf = (r: any) => String(r.id ?? r.code ?? '')
  const set = new Set(rows.map(keyOf))
  if (set.size !== rows.length) console.log('DUP-KEY', key, set.size, 'of', rows.length)
}
console.log('pages without id/code:', bad)
