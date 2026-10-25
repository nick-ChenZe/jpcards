# 日语卡片

用邮箱和用户名注册，登录后查看自己的学习历史。配图和语音没有密钥时保持关闭，不会挡住注册、登录和历史。

## 现在能做什么

- 注册、登录、退出。
- 历史只返回当前登录用户的卡片。点开一条可以查看这一张。
- 没有文本模型密钥时，已登录用户仍可以生成一张本地练习卡片：日语句子、读音和中文释义会写入自己的历史，不会请求
  DeepSeek。
- 文本模型的 `CHAT_API_KEY` 和 `CHAT_API_ENDPOINT` 都填写之后，句子改由模型生成。缺任何一个都不会请求 DeepSeek。
- 配图默认是 `noop`。Worker 绑定里有 `DASHSCOPE_API_KEY` 或 `BAILIAN_API_KEY` 时才会选中通义，正式模型是
  `qwen-image-3.0`。密钥只放在 Cloudflare secret 或本机 `.dev.vars`，不要写进仓库。有密钥时会请求 DashScope 同步接口
  `POST https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`，成功后把图片地址交给卡片。没有密钥时仍是「配图暂未开通」，不会发请求。生图失败时卡片继续可用，页面显示「配图这次没有生成」。
- `QWEN_IMAGE_TIER=turbo`（以及 `preview` / `draft`）才改用 `qwen-image-2.1-turbo`。评测通过之前，它不是默认。
- Seedream（`5.0-flash`）和 OpenAI GPT Image 必须把 `IMAGE_PROVIDER` 写成 `seedream` 或 `openai` 才会选中。OpenAI
  只认官方 API key，不要把 Codex 或 ChatGPT 的 OAuth 放进 Worker。
- 语音使用同一个百炼密钥。有 `DASHSCOPE_API_KEY` 或 `BAILIAN_API_KEY` 时，生成卡片会请求
  `qwen3-tts-flash`（`language_type` 为
  `Japanese`），并把可播放的音频地址写进这张卡片。没有密钥时仍是「语音暂未开通」，不会请求百炼。不会请求
  MiniMax。火山生图也不在请求路径上。
- 通义生图发请求前先走 `QwenImageLimiter`，大约每分钟 20 次。预览模型也走这个上限。

## 本地启动

在仓库根目录：

```bash
pnpm install
cp packages/backend/.dev.vars.example packages/backend/.dev.vars
```

把 `.dev.vars` 里的 `BETTER_AUTH_SECRET` 换成一段足够长的随机字符串，不要用 `better-auth-secret-123456789`。

```bash
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

`--live` 仍会直接退出。这个脚本只检查夹具，不发送生图请求。要看真实配图，把密钥放进 `.dev.vars` 后
`pnpm dev`，登录并生成一张卡片。留空密钥时卡片仍能生成，配图保持关闭。

## 部署

仓库里的 Worker 配置是 `packages/backend/wrangler.jsonc`。静态页走 ASSETS，接口走同一个 Worker，数据库绑定是 `DB`。

正式环境还需要你在 Cloudflare 里完成这些事，本仓库没有也不能代填：

1. `wrangler login`，或准备好有 Workers 和 D1 权限的 API token。
2. `pnpm --filter @jpcards/backend exec wrangler d1 create jpcards`，把输出的 database id 写进 `wrangler.jsonc` 的
   `database_id`。现在的全 0 id 只能本地开发。
3. `pnpm --filter @jpcards/backend db:migrate:remote`
4. `pnpm --filter @jpcards/backend exec wrangler secret put BETTER_AUTH_SECRET`
5. 文本生卡需要时再放 `CHAT_API_KEY` 和 `CHAT_API_ENDPOINT`。不要放火山或 MiniMax 的假密钥。
6. 百炼密钥只通过 `wrangler secret put DASHSCOPE_API_KEY` 或 `wrangler secret put BAILIAN_API_KEY`
   写入。同一个密钥会打开日语语音 `qwen3-tts-flash`，并让配图请求
   `qwen-image-3.0`。没有密钥时配图和语音都不会发请求。不要把密钥贴进仓库、提交或文档。Seedream、OpenAI 可以先空着。
7. `pnpm deploy`
8. 自定义域名和 HTTPS 在 Cloudflare 控制台给这个 Worker 加域名。Workers 自带的 `*.workers.dev` 已经是
   HTTPS；自己的域名要在控制台完成委派。

`BETTER_AUTH_URL` 可以不设。不设时，登录用当前请求的 origin。如果站点有固定域名，再用 secret 或 var 设成那个 `https://`
地址。

`CLOUDFLARE_API_TOKEN` 只留给你本机的 drizzle-kit，不要放进 Worker。
