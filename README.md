# 日札 · 日语卡片

每日抽一枚日签，用一句日语、一幅和纸水彩和一段朗读，慢慢积累日语。支持账户登录、假名注音、跟词高亮、中文释义、月历历史与三种纸色。

[打开日札](https://app.kiro-app.top/)

## 本地运行

使用 Node.js 与 pnpm 8.15.9：

```bash
pnpm install --frozen-lockfile
cp packages/backend/.dev.vars.example packages/backend/.dev.vars
# 将 .dev.vars 中的 BETTER_AUTH_SECRET 换为足够长的随机字符串
pnpm dev
```

打开 <http://localhost:8787>。没有模型密钥时仍能生成本地练习卡，配图和语音保持关闭。

## 项目结构

- `packages/frontend`：React 界面、和纸主题、阅读与动效。
- `packages/backend`：Cloudflare Worker、认证、生成接口和 D1 数据。
- `packages/shared`：共享类型与工具。
- `docs`：需求、界面规范、开发部署与费用说明。

## 文档

- [产品需求与行为约定](docs/requirements.md)
- [界面与动效规范](docs/hiyori-ui.md)
- [开发、配置与部署](docs/development.md)
- [费用、配额和密钥](docs/cost-and-quota.md)
- [AGENTS.md](AGENTS.md)：面向代码助手的仓库开发约定。

README 只保留项目介绍与快速入口；需求细节在 `docs/` 维护。
