// 缺陷修复专项验证：
//  (a) 批量核销 动词与写入字段   (b) 批量付款申请/批量用印/批量生成凭证 能真的生成单据
//  (c) 批量同步至账套能命中行    (d) 批量删除（danger 确认框）    (e) 分配弹窗端到端
(function () {
  const S = { done: false, results: [] }
  window.__fx = S
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const visible = (el) => !!el && el.getBoundingClientRect().height > 0 && el.getBoundingClientRect().width > 0
  const toasts = () => [...document.querySelectorAll('.ant-message-notice-content')].map((n) => txt(n))
  const clearToasts = () => document.querySelectorAll('.ant-message-notice-content').forEach((n) => n.parentElement?.remove())
  const cell = (rowIdx, colIdx) => {
    const tr = document.querySelectorAll('.ant-table-tbody tr')[rowIdx]
    return txt(tr?.querySelectorAll('td')[colIdx])
  }
  const rowCount = () => document.querySelectorAll('.ant-table-tbody tr').length

  // 勾选全部
  const selectAll = async () => {
    const head = document.querySelector('.ant-table-thead .ant-checkbox')
    if (!head) return false
    head.click()
    await sleep(420)
    return true
  }
  const clickBatch = async (name) => {
    const b = [...document.querySelectorAll('.table-toolbar .tb-left > button')].find((x) => txt(x) === name)
    if (!b) return false
    b.click()
    await sleep(500)
    return true
  }
  // 确认框：AntD 4.2 的按钮在 .ant-modal-confirm-btns 里；危险操作是 .ant-btn-dangerous
  const confirmOk = async () => {
    const wrap = [...document.querySelectorAll('.ant-modal-wrap')].filter(visible)[0]
    if (!wrap) return { ok: false, why: 'no-modal', title: '' }
    const title = txt(wrap.querySelector('.ant-modal-title, .ant-modal-confirm-title'))
    const btn = wrap.querySelector('.ant-modal-confirm-btns .ant-btn-primary') ||
                wrap.querySelector('.ant-modal-confirm-btns .ant-btn-dangerous') ||
                wrap.querySelector('.ant-modal-footer .ant-btn-primary')
    if (!btn) return { ok: false, why: 'no-ok-btn', title }
    btn.click()
    await sleep(700)
    return { ok: true, title }
  }
  const cancelSel = async () => {
    const c = [...document.querySelectorAll('.table-toolbar .tb-left button')].find((x) => txt(x) === '取消选择')
    if (c) { c.click(); await sleep(220) }
  }

  const CASES = [
    ['finance/flow', '批量核销', 'bankFlow'],
    ['finance/ap', '批量付款申请', 'voucher'],
    ['oa/expense', '批量生成凭证', 'voucher'],
    ['crm/contract', '批量用印', 'approval'],
    ['finance/account', '批量同步至账套', null],
    ['platform/message', '批量删除', null],
  ]

  const run = async () => {
    let cur = ''
    for (const [p, name, target] of CASES) {
      try {
        if (p !== cur) { cur = p; location.hash = '#/' + p; await sleep(1000) }
        clearToasts()
        if (!(await selectAll())) { S.results.push(p + '|' + name + '|NO-CHECKBOX'); continue }
        if (!(await clickBatch(name))) { S.results.push(p + '|' + name + '|BTN-MISSING'); await cancelSel(); continue }
        const cf = await confirmOk()
        const t = toasts().join(' / ').slice(0, 90)
        S.results.push(p + '|' + name + '|' + (t || 'NO-TOAST') + (cf.ok ? '|confirm(' + cf.title + ')' : '|' + cf.why))
        // 目标页校验：新生成的记录要真的在表里
        if (target) {
          const before = null
          location.hash = '#/' + target
          await sleep(1100)
          const first = [...document.querySelectorAll('.ant-table-tbody tr')][0]
          const cells = first ? [...first.querySelectorAll('td')].map((t2) => txt(t2)).slice(0, 8) : []
          S.results.push(p + '|' + name + '|TARGET ' + target + ' rows=' + rowCount() + ' row1=' + cells.join(' | ').slice(0, 160))
          location.hash = '#/' + p
          await sleep(1000)
        }
        await cancelSel()
      } catch (e) {
        S.results.push(p + '|' + name + '|THROW|' + String(e).slice(0, 120))
      }
    }
    S.done = true
  }
  window.__fxPromise = run()
  return 'fix-verify-started'
})()
