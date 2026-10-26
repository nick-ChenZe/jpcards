# 仓库开发约定

## 先读什么

- 项目介绍与快速启动：[README.md](README.md)。
- 业务行为、边界和验收：[docs/requirements.md](docs/requirements.md)。
- 和纸风格、动效与布局：[docs/hiyori-ui.md](docs/hiyori-ui.md)。
- 开发和部署：[docs/development.md](docs/development.md)；配额和密钥：[docs/cost-and-quota.md](docs/cost-and-quota.md)。

需求细节写在 docs/ 对应文档，避免在 README 或本文件复制整份需求。修改行为时同步相应文档，保持文案和现网一致。

## 代码入口

- `packages/frontend/src/components/pages/`：今日、日签墙和设置页面。
- `packages/frontend/src/components/TodayCard.tsx`：图文、译文与同一个音频播放器。
- `packages/frontend/src/components/SentenceReading.tsx`：假名注音与跟词高亮。
- `packages/frontend/src/styles/hiyori.css`：当前和纸界面样式；`src/index.css` 包含基础及旧样式，留意覆盖关系。
- `packages/backend/src/routes/`：接口；`src/quota/`：配额；`src/image/`：配图适配。
- `packages/backend/migrations/`：D1 迁移，新增结构用新迁移文件。

## 开发与验证

锁文件为 pnpm 8 格式，使用 `npx --yes pnpm@8.15.9`，不要用新版包管理器无关地改写锁文件。

```bash
npx --yes pnpm@8.15.9 --filter @jpcards/frontend build
node packages/backend/scripts/stage-kuromoji.mjs
npx --yes pnpm@8.15.9 --filter @jpcards/backend test
npx --yes pnpm@8.15.9 exec dprint check <修改过的文件>
```

按改动选择检查。界面改动检查真实浏览器的空白、等待、成功及失败状态，至少覆盖小屏和桌面；不以隐藏滚动条代替解决内容溢出，不截断日语与译文。检查正文、注音、播放和生成按钮是否完整可见，保留
44px 触控目标和减少动态效果支持。

新增业务分支或修复逻辑缺陷应补有意义的回归测试；纯样式微调优先通过浏览器验证。付费生成的验证尽量复用已有卡片或隔离的本地夹具，不在正式接口加入演示数据。

## 必须保留的行为

- 认证、管理员权限和用户历史隔离继续由服务端控制。
- 只有成功保存才扣生成额度，失败回退、幂等与限流不能因界面修改失效。
- 日语分词按原始索引高亮，音频只使用一份实例；旧卡分词不匹配时保留完整原句。
- 主品牌为「日札」，保留已确认的纯路径 Logo、纸色与原型导航符号。

## 配置与发布

密钥只放 Cloudflare secrets 或忽略的 `.dev.vars`；不读取、打印、提交或复制真实密钥到文档。保持现有 Worker、D1、域名和
secret 绑定。

按当前用户授权决定推送分支和是否发布；推送前拉取对应远端分支并解决冲突，保留其他未完成改动。部署前构建前端、复制
kuromoji 词典；如有新迁移，先应用迁移。保留线上 vars，发布后检查线上界面与流量版本。
