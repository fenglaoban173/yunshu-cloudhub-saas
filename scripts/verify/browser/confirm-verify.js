// 二次确认类批量动作专项验证（确认框按钮在 .ant-modal-confirm-btns 里）
(function () {
  const S = { done: false, results: [] }
  window.__cv = S
  const CASES = [
    ['crm/contact', '批量标记关键'], ['crm/product', '批量下架'],
    ['oa/approval', '批量通过'], ['oa/leave', '批量通过'], ['oa/travel', '批量通过'],
    ['oa/overtime', '批量通过'], ['oa/expense', '批量通过'], ['oa/notice', '批量置顶'],
    ['oa/notice', '批量撤回'], ['oa/knowledge', '批量发布'], ['finance/bookset', '批量停用'],
    ['finance/voucher', '批量审核'], ['finance/ap', '批量核销'], ['finance/invoice', '批量查验'],
    ['finance/invoice', '批量开具'], ['finance/bank', '批量注销'], ['finance/flow', '批量核销'],
    ['finance/recon', '批量开始对账'], ['finance/asset', '批量处置'], ['finance/close', '批量结账'],
    ['finance/tax', '批量申报'], ['platform/user', '批量停用'], ['platform/role', '批量停用'],
    ['platform/dept', '批量停用'], ['platform/dict', '批量停用'], ['platform/number', '批量停用'],
    ['platform/tenant', '批量开通'], ['platform/message', '批量标记已读'], ['platform/message', '批量删除'],
    ['platform/user', '批量重置密码'], ['crm/lead-pool', '批量退回公海'],
    ['oa/approval', '批量催办'], ['finance/ar', '批量催收'], ['finance/ap', '批量付款申请'],
    ['crm/lead', '批量转商机'], ['crm/contract', '批量用印'], ['finance/asset', '批量折旧'],
    ['finance/flow', '批量自动匹配'], ['finance/account', '批量同步至账套'],
    ['platform/config', '批量重置'], ['oa/flow', '批量启用'], ['oa/staff', '批量调整部门'],
  ]
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const visible = (el) => !!el && el.getBoundingClientRect().height > 0 && el.getBoundingClientRect().width > 0
  const toasts = () => [...document.querySelectorAll('.ant-message-notice-content')].map((n) => txt(n))
  const clearToasts = () => document.querySelectorAll('.ant-message-notice-content').forEach((n) => n.parentElement?.remove())

  const run = async () => {
    let cur = ''
    for (const [p, name] of CASES) {
      try {
        if (p !== cur) {
          cur = p
          location.hash = '#/' + p
          await sleep(950)
        }
        const head = document.querySelector('.ant-table-thead .ant-checkbox')
        if (!head) { S.results.push(p + '|' + name + '|NO-CHECKBOX'); continue }
        head.click()
        await sleep(420)
        const b = [...document.querySelectorAll('.table-toolbar .tb-left > button')].find((x) => txt(x) === name)
        if (!b) { S.results.push(p + '|' + name + '|BTN-MISSING'); continue }
        clearToasts()
        b.click()
        await sleep(450)
        const wraps = [...document.querySelectorAll('.ant-modal-wrap')].filter(visible)
        let extra = ''
        if (wraps.length) {
          const m = wraps[0]
          const title = txt(m.querySelector('.ant-modal-title, .ant-modal-confirm-title'))
          const ok = m.querySelector('.ant-btn-primary')
          if (ok) { ok.click(); await sleep(600); extra = '|confirm(' + title + ')' }
          else extra = '|NO-OK-BTN'
        } else extra = '|NO-MODAL'
        const t = toasts()
        S.results.push(p + '|' + name + '|' + (t.join(' / ').slice(0, 80) || 'NO-TOAST') + extra)
        // 清理
        document.querySelectorAll('.ant-modal-close, .ant-modal-confirm-btns .ant-btn:not(.ant-btn-primary)').forEach((x) => x.click())
        document.querySelectorAll('.ant-message-notice').forEach((n) => n.remove())
        await sleep(180)
        const cancel = [...document.querySelectorAll('.table-toolbar .tb-left button')].find((x) => txt(x) === '取消选择')
        if (cancel) { cancel.click(); await sleep(200) }
      } catch (e) {
        S.results.push(p + '|' + name + '|THROW|' + String(e).slice(0, 110))
      }
    }
    S.done = true
  }
  window.__cvPromise = run()
  return 'confirm-verify-started'
})()
