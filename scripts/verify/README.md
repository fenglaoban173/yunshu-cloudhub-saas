# 验证脚本

CloudHub 是纯前端演示项目，没有后端和单测框架，功能是否真的生效靠**在浏览器里逐个点**来验证。
这里的脚本就是那套「逐个点」的工具，分两类：

| 目录 | 类型 | 怎么跑 |
| --- | --- | --- |
| `static/` | 静态审计（读源码与数据，不碰浏览器） | `npx tsx scripts/verify/static/<name>.ts` |
| `browser/` | 浏览器探针（在真实页面上点击） | 见下方 |

## 静态审计

| 脚本 | 检查什么 | 期望 |
| --- | --- | --- |
| `static/sort-static.ts` | 424 个可排序列的升/降序结果是否单调 | 单调性异常 0；升降序结果相同 0 |
| `static/rowkey-audit.ts` | 每页数据的行唯一键（id / code）是否齐全、有无重复 | `pages without id/code: 0` |
| `static/rule-count.ts` | 动作规则覆盖了多少按钮名 | `names without explicit rule: 0` |

```bash
npx tsx scripts/verify/static/sort-static.ts
npx tsx scripts/verify/static/rowkey-audit.ts
npx tsx scripts/verify/static/rule-count.ts
```

## 浏览器探针

浏览器探针用 `agent-browser` 的 CDP 模式跑，**必须连隔离的标签页**（并发会话共用默认浏览器，抢占会打乱别人的页面）：

```bash
# 1) 起一个隔离的 CDP 标签页（记下返回的 id）
curl -X PUT "http://127.0.0.1:9222/json/new?http://127.0.0.1:5275/#/dashboard"

# 2) 启动探针（脚本会往 window 上挂状态对象并立即返回）
agent-browser --cdp 9222 --session cloudhub eval --stdin < scripts/verify/browser/batch-verify.js

# 3) 轮询结果（探针跑完前会打印进度）
agent-browser --cdp 9222 --session cloudhub eval --stdin < scripts/verify/browser/poll.js
```

| 脚本 | 覆盖什么 | 状态对象 |
| --- | --- | --- |
| `browser/batch-verify.js` | 48 个列表页：勾选 → 工具栏切换 → 逐个批量按钮 → 取消选择回到原样 | `__bat` |
| `browser/confirm-verify.js` | 42 个带二次确认的批量动作：确认框标题、动词、条数、落库字段 | `__cv` |
| `browser/fix-verify.js` | 缺陷回归：批量核销的动词、批量转化能不能真的生成单据、同步账套能不能命中行、批量删除 | `__fx` |
| `browser/read-verify.js` | 只读校验：生成的凭证 / 审批 / 同步时间在目标页是否长得对 | `__rd` |
| `browser/tag-audit.js` | 状态标签字典是否覆盖数据里出现的全部取值 | `__tag` |
| `browser/batch-coverage.js` | 每个页面的批量动作是否都有显式规则（不走兜底推断） | `__bcov` |
| `browser/reload.js` | 刷新页面（改了 Pinia store 后必须刷新，HMR 不会更新已有 store 实例） | — |

### 写探针时的几个约定

- 脚本必须 IIFE 包裹并 `return` 一个字符串：`agent-browser eval --stdin` 顶层 `return` 会报 `Illegal return statement`。
- 单次 eval 约 30 秒超时 → 用「启动 + 轮询 `window.__x`」的模式，别在一个脚本里跑完整轮巡检。
- 返回大 JSON 会被静默转成 `{}` → 要在页面内先聚合成字符串再返回。
- Ant Design Vue 4.2 的确认框按钮在 **`.ant-modal-confirm-btns`** 里（不是 `.ant-modal-footer`），
  危险操作（`okType: 'danger'`）的按钮 class 是 `.ant-btn-dangerous` 而不是 `.ant-btn-primary`。
- `a-select` 只在 **mousedown** 展开：脚本要 dispatch mousedown + mouseup + click 到 `.ant-select-selector`。
- 表格第一行可能是 AntD 的测量行（`.ant-table-measure-row`），读数据前要过滤掉。
