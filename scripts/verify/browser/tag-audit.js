// 状态标签审计：每个 tag 列的字典是否覆盖了数据里出现的全部取值
(function () {
  const S = { done: false, rows: [] }
  window.__tag = S
  const run = async () => {
    const pagesMod = await import('/src/mock/pages.ts')
    const pages = pagesMod.pages
    for (const [key, def] of Object.entries(pages)) {
      const data = Array.isArray(def.data) ? def.data : []
      for (const col of def.columns) {
        if (!col.statusMap) continue
        const vals = [...new Set(data.map((r) => String(r?.[col.key] ?? '')).filter((v) => v && v !== '—'))]
        if (!vals.length) {
          S.rows.push(key + '|' + col.key + '|EMPTY-COLUMN|列有字典但数据里没这个字段')
          continue
        }
        const missing = vals.filter((v) => !(v in col.statusMap))
        if (missing.length) S.rows.push(key + '|' + col.key + '|MISSING|' + missing.join(','))
      }
    }
    S.done = true
  }
  window.__tagPromise = run()
  return 'tag-audit-started'
})()
