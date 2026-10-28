(function () {
  // 用法：agent-browser --cdp 9222 --session cloudhub eval --stdin < tmp-verify/batch-verify.js
  const S = { done: false, status: 'running', results: [], errors: [] }
  window.__bat = S
  if (!window.__errHooked) {
    window.__errHooked = true
    window.__errs = []
    const oe = console.error
    console.error = function (...a) { window.__errs.push(a.map(String).join(' ').slice(0, 200)); oe.apply(this, a) }
    window.addEventListener('error', (e) => window.__errs.push('ERR ' + e.message))
    window.addEventListener('unhandledrejection', (e) => window.__errs.push('REJ ' + String(e.reason).slice(0, 160)))
  }

  const PATHS = [
    'crm/lead-pool', 'crm/lead', 'crm/account', 'crm/contact', 'crm/opportunity', 'crm/quote',
    'crm/contract', 'crm/receipt', 'crm/follow', 'crm/target', 'crm/product',
    'oa/approval', 'oa/flow', 'oa/leave', 'oa/travel', 'oa/overtime', 'oa/expense', 'oa/notice',
    'oa/meeting', 'oa/knowledge', 'oa/staff', 'oa/seal', 'oa/okr', 'oa/schedule',
    'finance/bookset', 'finance/account', 'finance/voucher', 'finance/gl', 'finance/ar', 'finance/ap',
    'finance/invoice', 'finance/bank', 'finance/flow', 'finance/recon', 'finance/asset',
    'finance/close', 'finance/cashier', 'finance/tax',
    'platform/user', 'platform/role', 'platform/dept', 'platform/dict', 'platform/number',
    'platform/tenant', 'platform/message', 'platform/log', 'platform/login-log', 'platform/config',
  ]

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const visible = (el) => !!el && el.getBoundingClientRect().height > 0 && el.getBoundingClientRect().width > 0

  function toasts() {
    return [...document.querySelectorAll('.ant-message-notice-content')].map((n) => txt(n))
  }
  function clearToasts() {
    document.querySelectorAll('.ant-message-notice-content').forEach((n) => n.parentElement?.remove())
  }
  function openModals() {
    return [...document.querySelectorAll('.ant-modal-wrap')].filter(visible)
  }
  function openDrawers() {
    return [...document.querySelectorAll('.ant-drawer')].filter(visible)
  }
  function closeAll() {
    document.querySelectorAll('.ant-drawer-close').forEach((b) => b.click())
    document.querySelectorAll('.ant-modal-close').forEach((b) => b.click())
    document.querySelectorAll('.ant-modal-footer .ant-btn:not(.ant-btn-primary)').forEach((b) => b.click())
    document.querySelectorAll('.ant-message-notice').forEach((n) => n.remove())
  document.querySelectorAll('.ant-select-dropdown').forEach((d) => { if (d.getBoundingClientRect().height > 0) d.remove() })
  document.querySelectorAll('.ant-select-dropdown').forEach((d) => { if (d.getBoundingClientRect().height > 0) d.remove() })
  }
  function clickByText(sel, text) {
    const el = [...document.querySelectorAll(sel)].find((n) => txt(n).includes(text))
    if (!el) return false
    el.click()
    return true
  }
  function tbButtons() {
    return [...document.querySelectorAll('.table-toolbar .tb-left > button')].map((b) => txt(b))
  }

  const run = async () => {
    for (const p of PATHS) {
      try {
        window.__errs.length = 0
        location.hash = '#/' + p
        await sleep(900)
        const zone = document.querySelector('.table-toolbar')
        if (!zone) { S.results.push(p + '||NO-TOOLBAR'); continue }
        const normalBtns = tbButtons()
        // 勾选全部
        const head = document.querySelector('.ant-table-thead .ant-checkbox')
        if (!head) { S.results.push(p + '||NO-CHECKBOX'); continue }
        head.click()
        await sleep(450)
        const selTxt = txt(document.querySelector('.tb-selected'))
        const batchBtns = tbButtons()
        const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row').length
        S.results.push(p + '|MODE|' + (selTxt || 'NO-SEL') + '|' + batchBtns.join('/') + '|rows=' + rows + '|normal=' + normalBtns.join('/'))
        // 逐个点批量按钮
        for (const name of batchBtns.filter((n) => n !== '取消选择' && n !== '更多')) {
          clearToasts()
          const btns = [...document.querySelectorAll('.table-toolbar .tb-left > button')]
          const b = btns.find((x) => txt(x) === name)
          if (!b) { S.results.push(p + '|' + name + '|BTN-MISSING'); continue }
          b.click()
          await sleep(420)
          // 确认弹窗 → 点「确认」真正执行
          const md = openModals()
          let extra = ''
          if (md.length) {
            const m = md[0]
            const title = txt(m.querySelector('.ant-modal-title'))
            const isAssign = /分配/.test(title)
            if (isAssign) {
              const sel = m.querySelector('.ant-select-selector') || m.querySelector('.ant-select')
              if (sel) {
                sel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
                sel.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
                sel.click()
                await sleep(420)
                const dds = [...document.querySelectorAll('.ant-select-dropdown')].filter((d) => d.getBoundingClientRect().height > 0)
                const opt = dds[0]?.querySelector('.ant-select-item-option')
                if (opt) { opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); opt.click() }
                await sleep(300)
              }
              const ok = m.querySelector('.ant-modal-footer .ant-btn-primary, .ant-modal-btns .ant-btn-primary')
              if (ok) { ok.click(); await sleep(520); extra = '|assign-ok' }
              else extra = '|assign-no-ok'
            } else {
              const ok = m.querySelector('.ant-modal-footer .ant-btn-primary, .ant-modal-btns .ant-btn-primary')
              if (ok) { ok.click(); await sleep(520); extra = '|confirm' }
              else extra = '|confirm-no-ok'
            }
          }
          const dr = openDrawers()
          let dtext = ''
          if (dr.length) {
            dtext = '|drawer:' + txt(dr[0].querySelector('.ant-drawer-title'))
            const dc = dr[0].querySelector('.ant-drawer-close')
            if (dc) dc.click()
            await sleep(260)
          }
          const t = toasts()
          S.results.push(p + '|' + name + '|' + (t.join(' / ').slice(0, 90) || 'NO-TOAST') + extra + dtext)
          closeAll()
          await sleep(150)
        }
        // 取消选择 → 回到普通模式
        const cancel = [...document.querySelectorAll('.table-toolbar .tb-left button')].find((x) => txt(x) === '取消选择')
        if (cancel) { cancel.click(); await sleep(320) }
        const back = tbButtons()
        S.results.push(p + '|BACK|' + (back.join('/') === normalBtns.join('/') ? 'SAME' : 'DIFF:' + back.join('/')))
        if (window.__errs.length) S.results.push(p + '|CONSOLE|' + window.__errs.slice(0, 2).join(' ; ').slice(0, 160))
      } catch (e) {
        S.results.push(p + '|THROW|' + String(e).slice(0, 140))
      }
    }
    S.status = 'done'
    S.done = true
  }
  window.__batPromise = run().catch((e) => { S.status = 'error'; S.done = true; S.error = String(e) })
  return 'batch-verify-started'

})()
