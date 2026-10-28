# 贡献指南 / Contributing

感谢你愿意为这个项目花时间。这是一份**纯前端演示项目**（Mock 数据、零后端），
贡献方向主要是：交互层的真实化、页面与动作规则的可配置化、文档与验证脚本。

## 环境要求

| 依赖 | 版本 |
| --- | --- |
| Node.js | ≥ 18（推荐 20 LTS） |
| npm | ≥ 9 |

```bash
npm install
npm run dev      # 开发服务，默认 http://127.0.0.1:5273
npm run build    # vue-tsc 类型检查 + 生产构建
npm run preview  # 预览构建产物
```

## 提交前请确保

```bash
npm run typecheck      # vue-tsc --noEmit，必须无报错
npm run build          # 必须构建通过
npm run verify:static  # 静态审计：排序单调性 / 行主键 / 动作规则覆盖率
```

`verify:static` 是这个项目**唯一的自动化回归**（没有单测框架），
它检查的是三件容易在改动中悄悄坏掉的事：

- 列表页每一列的升/降序是否真的单调（数据写死时很容易排不出顺序）；
- 每页记录的行主键（`id` / `code`）是否齐全且不重复；
- 页面上出现的每个按钮名，是否都有显式的动作规则（不走兜底推断）。

浏览器里的行为回归脚本在 `scripts/verify/browser/`，用法见
[`scripts/verify/README.md`](scripts/verify/README.md)。

## 代码约定

- **页面 = 配置**。48 个列表页由 `src/mock/pages.ts` 的 `PageDef` 描述，
  由 `src/views/ListPage.vue` 统一渲染。新增一个列表页优先写配置，而不是复制一份 Vue 组件。
- **动作 = 规则**。按钮的点击行为写在 `src/config/actionRules.ts`，
  由 `src/composables/useAction.ts` 统一执行。**不要在页面组件里写 `message.info('xxx（演示）')`** ——
  这类占位 toast 是本项目明令禁止的，任何按钮都要有真实副作用。
- **批量动作**写在各页 `PageDef.batchActions` 里，并在 `actionRules.ts` 中补上显式规则；
  `needSelect: true` 表示该动作需要先勾选行。
- **数据是活的**。新增/修改/删除都落在 Pinia 的 `useDataStore` 上，
  刷新页面即回到初始 Mock 数据（演示项目无后端）。
- 注释用中文，与既有代码保持一致；只在解释「为什么这么做」时写注释。

## 提交信息

用中文或英文均可，格式参考 [Conventional Commits](https://www.conventionalcommits.org/)：

```
feat(actionRules): 给「批量用印」补上目标页固定字段
fix(useAction): 批量转化时状态不再跟随来源记录
docs(readme): 补充批量动作的验证结果
```

## 分支与 PR

- 从 `main` 切分支：`feat/…`、`fix/…`、`docs/…`。
- PR 描述里请写清：**改了什么、为什么、怎么验证的**（截图或探针输出）。
- 涉及交互改动的 PR，附上浏览器验证的结果（`scripts/verify/README.md` 里有现成脚本）。

## 需要帮忙的方向

1. **动作规则的可视化配置**：`actionRules.ts` 现在是纯 TS 对象，做一个配置页会更友好。
2. **单测**：把静态审计脚本的断言升级成真正的测试用例（Vitest）。
3. **无障碍**：键盘导航、焦点环、图标按钮的 `aria-label`。
4. **多语言**：目前界面文案全部硬编码中文，接入 i18n 的成本不高。
5. **移动端适配**：当前按桌面端 1440px 设计。

## 许可

提交即表示你同意你的贡献以 [MIT](LICENSE) 许可发布。
