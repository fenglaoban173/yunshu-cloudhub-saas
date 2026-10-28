# 安全策略 / Security Policy

## 关于这个项目

云枢 CloudHub 是一个**纯前端演示项目**：没有后端、没有数据库、没有账号系统，
所有数据都是仓库里的 Mock 数据，登录只是 `localStorage` 里模拟的一个 token。
它不会被部署到生产环境承载真实业务。

即便如此，如果你发现了问题，依然欢迎报告。

## 支持的版本

| 版本 | 状态 |
| --- | --- |
| `main` | ✅ 接收安全修复 |

## 报告漏洞

**请不要用公开 issue 报告安全问题。** 优先使用 GitHub 的私密漏洞报告：

1. 打开仓库的 **Security** 标签页；
2. 点击 **Report a vulnerability**；
3. 填写漏洞描述与复现步骤。

如果该功能不可用，也可以通过维护者的 GitHub 主页（[fenglaoban173](https://github.com/fenglaoban173)）
发起私密联系。

请尽量提供：

- 受影响的文件 / 位置；
- 复现步骤；
- 影响的评估（DoS / XSS / 凭据泄露等）。

## 响应时效

这是一个个人维护的演示项目，目标是 **7 天内**给出初步回应。
请不要在漏洞公开披露前对外传播细节。

## 已知的「非漏洞」

以下属于设计如此，不作为漏洞处理：

- 登录仅做前端状态模拟，任何凭据都能进入；
- 所有业务数据在浏览器内存中，刷新即重置，用户之间互不可见；
- 权限（菜单 / 按钮）由前端根据 `localStorage` 中的身份决定，**不构成访问控制**。
  真实系统必须由后端在登录响应中下发 `apps` 与 `perms` 并在服务端鉴权。

## 依赖安全

依赖版本记录在 `package-lock.json`，CI 会执行 `npm ci` 安装。
已知 `echarts` 5.x 存在一条 moderate 级别的 XSS 通告
（[GHSA-fgmj-fm8m-jvvx](https://github.com/advisories/GHSA-fgmj-fm8m-jvvx)），
修复需要升级到 ECharts 6（破坏性变更），已记录在 README 的「已知说明」中。
