/**
 * 轮询助手：把浏览器里挂着的验证状态取回来
 * ---------------------------------------------------------------------------
 * 用法（先把某个探针脚本跑起来，再轮询）：
 *   agent-browser --cdp 9222 --session cloudhub eval --stdin < scripts/verify/browser/batch-verify.js
 *   agent-browser --cdp 9222 --session cloudhub eval --stdin < scripts/verify/browser/poll.js
 *
 * 每个探针脚本都会往 window 上挂一个状态对象（window.__bat / __cv / __fx / __rd / __tag / __bcov），
 * 这个脚本依次检查它们：没跑就跳过，跑完了就打印结果，没跑完就报进度。
 */
(function () {
  const KEYS = {
    __bat: 'batch-verify（48 页批量动作巡检）',
    __cv: 'confirm-verify（二次确认类批量动作）',
    __fx: 'fix-verify（缺陷回归）',
    __rd: 'read-verify（目标页只读校验）',
    __tag: 'tag-audit（状态字典覆盖率）',
    __bcov: 'batch-coverage（批量规则显式覆盖率）',
  }
  const out = []
  for (const [k, label] of Object.entries(KEYS)) {
    const s = window[k]
    if (!s) continue
    if (s.done) {
      const body = s.results || s.rows || []
      out.push('=== ' + label + ' ===')
      out.push(body.length ? body.join('\n') : '(无异常项)')
      if (s.summary) out.push('summary: ' + s.summary)
      if (window.__errs && window.__errs.length) out.push('console errors: ' + window.__errs.length)
    } else {
      out.push('=== ' + label + ' === 进行中：' + ((s.results || s.rows || []).length) + ' 条')
    }
  }
  if (!out.length) return '没有正在运行的探针'
  return out.join('\n')
})()
