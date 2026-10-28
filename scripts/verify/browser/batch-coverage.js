// 批量动作覆盖率：每个页面的 batchActions 是否都有显式规则（不走兜底推断）
(function () {
  const S = { done: false, rows: [] }
  window.__bcov = S
  const run = async () => {
    const pm = await import('/src/mock/pages.ts')
    const am = await import('/src/config/actionRules.ts')
    const pages = pm.pages
    const rules = am.actionRules
    let pagesWithBatch = 0
    let total = 0
    let explicit = 0
    let fallback = []
    for (const [key, def] of Object.entries(pages)) {
      const list = def.batchActions ?? []
      if (list.length) pagesWithBatch++
      if (list.length < 2) S.rows.push('FEW|' + key + '|' + list.join('/'))
      for (const name of list) {
        total++
        if (rules[name]) explicit++
        else fallback.push(key + ':' + name)
      }
    }
    S.rows.unshift('SUMMARY|pages=' + Object.keys(pages).length + ' withBatch=' + pagesWithBatch + ' names=' + total + ' explicit=' + explicit)
    if (fallback.length) S.rows.push('FALLBACK|' + fallback.join(','))
    S.done = true
  }
  window.__bcovPromise = run()
  return 'batch-coverage-started'
})()
