# 日语卡片

Cloudflare Worker 入口。静态页走 ASSETS，接口和页面在同一个 Worker 里。请求路径只读 Worker 绑定 `c.env`，不读
`process.env`。

## 现在能做什么

- `GET /api/health` 返回 `{ "ok": true }`。`GET /api/hello` 同样公开。
- 数据库用 D1 绑定 `DB`。历史按当前会话里的用户 id 查询。
- 文本模型的 `CHAT_API_KEY` 和 `CHAT_API_ENDPOINT` 都填写之后，才可以生成一句日语并写入历史。缺任何一个都不会请求
  DeepSeek。
- 配图默认是 `noop`。Worker 绑定里有 `DASHSCOPE_API_KEY` 或 `BAILIAN_API_KEY` 时才会选中通义，正式模型是
  `qwen-image-3.0`。密钥只放在 Cloudflare secret 或本机
  `.dev.vars`，不要写进仓库。当前版本即使有密钥也不会发出生图请求。
- `QWEN_IMAGE_TIER=turbo` 只把预览模型标成 `qwen-image-2.1-turbo`。评测通过之前，它不是默认。
- Seedream（`5.0-flash`）和 OpenAI GPT Image 必须把 `IMAGE_PROVIDER` 写成 `seedream` 或 `openai` 才会选中。OpenAI
  只认官方 API key，不要把 Codex 或 ChatGPT 的 OAuth 放进 Worker。
- 语音是占位，不会请求 MiniMax。火山生图也不在请求路径上。
- 接入 `qwen-image-3.0` 时先按大约每分钟 20 次排队，不要假设可以更高并发。预览模型也走这个上限。以后真正发请求时要先走
  `QwenImageLimiter`。

## 本地启动

在仓库根目录：

```bash
pnpm install
cp packages/backend/.dev.vars.example packages/backend/.dev.vars
pnpm dev
```

浏览器打开 `http://localhost:8787`。这个命令会构建前端、把 D1 迁移应用到本地，再用 Wrangler 同时提供页面和 `/api`。

只跑后端测试：

```bash
pnpm --filter @jpcards/backend test
```

姓名卡盲评夹具在 `packages/backend/fixtures/image-name-cards.json`。占位脚本不会联网：

```bash
pnpm --filter @jpcards/backend eval:image
```

`--live` 会直接退出，并说明客户端还没接入。

## 部署

仓库里的 Worker 配置是 `packages/backend/wrangler.jsonc`。静态页走 ASSETS，接口走同一个 Worker，数据库绑定是 `DB`。

正式环境还需要你在 Cloudflare 里完成这些事，本仓库没有也不能代填：

1. `wrangler login`，或准备好有 Workers 和 D1 权限的 API token。
2. `pnpm --filter @jpcards/backend exec wrangler d1 create jpcards`，把输出的 database id 写进 `wrangler.jsonc` 的
   `database_id`。现在的全 0 id 只能本地开发。
3. `pnpm --filter @jpcards/backend db:migrate:remote`
4. 需要登录时再放 `BETTER_AUTH_SECRET`：`pnpm --filter @jpcards/backend exec wrangler secret put BETTER_AUTH_SECRET`
5. 文本生卡需要时再放 `CHAT_API_KEY` 和 `CHAT_API_ENDPOINT`。不要放火山或 MiniMax 的假密钥。
6. 配图密钥只通过 `wrangler secret put DASHSCOPE_API_KEY` 或 `wrangler secret put BAILIAN_API_KEY`
   写入。不要把密钥贴进仓库、提交或文档。Seedream、OpenAI 可以先空着。
7. `pnpm deploy`
8. 自定义域名和 HTTPS 在 Cloudflare 控制台给这个 Worker 加域名。Workers 自带的 `*.workers.dev` 已经是
   HTTPS；自己的域名要在控制台完成委派。

`CLOUDFLARE_API_TOKEN` 只留给你本机的 drizzle-kit，不要放进 Worker。
