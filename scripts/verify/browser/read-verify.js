// 只读校验：读取各目标页表格内容（不触发任何写操作）
(function () {
  const S = { done: false, results: [] }
  window.__rd = S
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const readTable = () => {
    const heads = [...document.querySelectorAll('.ant-table-thead th')].map((n) => txt(n))
    const rows = [...document.querySelectorAll('.ant-table-tbody tr')]
      .filter((tr) => !String(tr.className).includes('measure-row'))
      .slice(0, 2)
    return { heads, rows: rows.map((tr) => [...tr.querySelectorAll('td')].map((td) => txt(td))) }
  }
  const pick = (heads, row, title) => {
    const i = heads.findIndex((h) => h.replace(/[\s↑↓]/g, '') === title)
    return i >= 0 ? row[i] : ''
  }
  const go = async (route) => { location.hash = '#/' + route; await sleep(1100) }

  const run = async () => {
    await go('finance/voucher')
    {
      const t = readTable()
      t.rows.forEach((r, i) => S.results.push('voucher row' + (i + 1) + ' 凭证号=' + pick(t.heads, r, '凭证号') +
        ' 期间=' + pick(t.heads, r, '期间') + ' 日期=' + pick(t.heads, r, '日期') +
        ' 账套=' + pick(t.heads, r, '账套') + ' 摘要=' + pick(t.heads, r, '摘要') +
        ' 来源=' + pick(t.heads, r, '来源') + ' 借=' + pick(t.heads, r, '借方合计') +
        ' 贷=' + pick(t.heads, r, '贷方合计') + ' 制单=' + pick(t.heads, r, '制单人') +
        ' 状态=' + pick(t.heads, r, '状态')))
    }
    await go('oa/approval')
    {
      const all = [...document.querySelectorAll('.ant-tabs-tab, .tab-item, .tabs-item')].find((n) => txt(n) === '全部')
      if (all) { all.click(); await sleep(700) }
      const t = readTable()
      t.rows.forEach((r, i) => S.results.push('approval row' + (i + 1) + ' 单号=' + pick(t.heads, r, '单号') +
        ' 类型=' + pick(t.heads, r, '类型') + ' 标题=' + pick(t.heads, r, '标题') +
        ' 申请人=' + pick(t.heads, r, '申请人') + ' 金额=' + pick(t.heads, r, '金额') +
        ' 状态=' + pick(t.heads, r, '状态')))
    }
    await go('finance/account')
    {
      const t = readTable()
      const r0 = t.rows[0] || []
      S.results.push('finAccount row1 编码=' + pick(t.heads, r0, '科目编码') + ' 名称=' + pick(t.heads, r0, '科目名称') +
        ' 最近同步=' + pick(t.heads, r0, '最近同步') + ' 状态=' + pick(t.heads, r0, '状态'))
    }
    await go('finance/flow')
    {
      const t = readTable()
      const r0 = t.rows[0] || []
      S.results.push('bankFlow row1 摘要=' + pick(t.heads, r0, '摘要') + ' 已对账=' + pick(t.heads, r0, '已对账'))
    }
    await go('oa/staff')
    {
      const t = readTable()
      const r0 = t.rows[0] || []
      S.results.push('staff row1 姓名=' + pick(t.heads, r0, '姓名') + ' 部门=' + pick(t.heads, r0, '部门'))
    }
    S.done = true
  }
  window.__rdPromise = run()
  return 'read-verify-started'
})()
