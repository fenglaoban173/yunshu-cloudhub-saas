import { actionRules } from '@/config/actionRules'
import { pages } from '@/mock/pages'
const keys = Object.keys(actionRules)
console.log('rules:', keys.length)
const batch = keys.filter((k) => k.startsWith('批量'))
console.log('batch rules:', batch.length)
let names = 0
const all = new Set<string>()
for (const def of Object.values(pages)) {
  for (const n of [...(def.toolbar ?? []), ...(def.batchActions ?? []), ...(def.rowActions ?? [])]) { all.add(n); names++ }
  if (def.primaryAction) { all.add(def.primaryAction); names++ }
}
console.log('distinct button names on pages:', all.size, 'total occurrences:', names)
const missing = [...all].filter((n) => !actionRules[n])
console.log('names without explicit rule:', missing.length, missing.join('/'))
