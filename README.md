# 日语卡片

用邮箱和用户名注册，登录后查看自己的学习历史。配图和语音没有密钥时保持关闭。语音这一次失败也不会挡住卡片。这些都不会挡住注册、登录和历史。全量卡片的页面已经接上，但角色闸默认关闭。

## 现在能做什么

- 注册、登录、退出。
- 历史只返回当前登录用户的卡片。点开一条可以查看这一张。看历史不扣生成次数。
- 全量卡片只认 Worker secret `ADMIN_USER_IDS`（英文逗号分隔的 userId），默认关闭。secret 没设、为空，或当前登录的
  `user.id` 不在名单里时，`GET /api/admin/cards` 返回 403，并且不查库。邮箱不算管理员。`GET /api/me` 只多一个布尔字段
  `isAdmin`，不返回名单。历史页和设置页只在 `isAdmin` 为真时显示「全部卡片」。`/api/history`
  始终只返回自己的卡片，管理员也不例外。这个接口只读。每次成功的列表请求在日志里记
  `adminId`、`timestamp`、`resultCount`，不记卡片内容。
- 每个登录用户每天可以生成 20 张卡片，按北京时间零点重置。只有卡片生成并保存成功才扣 1
  次，配图和语音算在同一次里，不另扣。生成失败不扣当天次数。两次生成至少间隔 5
  秒。用完后探索页按钮不可点，并显示「今日额度已用完，明天 0 点（北京时间）再来」。还有次数时仍显示「今日还可生成 x/20
  张」。`GET /api/me/quota` 返回 `{limit, used, remaining, resetsAt}`。
- 界面字体是 Noto Sans SC 400/500，日文句子是 Noto Serif JP 500。子集放在 `packages/frontend/src/fonts/`，样式写在
  `packages/frontend/src/fonts/fonts.css`。生产页面不请求 `fonts.googleapis.com` 或 `fonts.gstatic.com`。这三个 woff2
  来自 Fontsource 5.3.1 打包的 Google Fonts 官方语言子集（简体中文约 7900 字、日文约 6900 字，均含常用拉丁字母），不是
  Noto CJK 整包。`pnpm dev` / `pnpm deploy` 构建前端时，Vite 把它们打进 `packages/frontend/dist`，Worker 通过 ASSETS
  同源提供。族名仍是 `--font-zh` 和 `--font-ja`。许可是 SIL Open Font License 1.1，全文在
  `packages/frontend/src/fonts/OFL.txt`。
- 没有文本模型密钥时，已登录用户仍可以生成一张本地练习卡片：日语句子、读音和中文释义会写入自己的历史，不会请求
  DeepSeek。练习词表本身带有中文释义。
- 模型生卡必须拿到非空中文释义才会写入历史。没有释义时不入库，探索页提示「这张没有中文意思，没有保存。请再试一次。」这一次不计入当天的
  20 次。
- 文本模型的 `CHAT_API_KEY` 和 `CHAT_API_ENDPOINT` 都填写之后，句子、假名读音和中文释义由这一次生成写入卡片。读音优先用
  kuromoji 词典；词典加载失败时改用模型给出的假名，并在日志里记下 `[reading]`，不会静默存空串。缺任何一个密钥都不会请求
  DeepSeek。`pnpm dev` / `pnpm deploy` 会把词典复制到前端静态资源 `kuromoji/dict/`，Worker 通过 ASSETS 读取。
- 配图默认是 `noop`。Worker 绑定里有 `DASHSCOPE_API_KEY` 或 `BAILIAN_API_KEY` 时才会选中通义，正式模型是
  `qwen-image-3.0`。密钥只放在 Cloudflare secret 或本机 `.dev.vars`，不要写进仓库。有密钥时会请求 DashScope 同步接口
  `POST https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`，成功后把图片地址交给卡片。没有密钥时仍是「配图暂未开通」，不会发请求。生图失败时卡片继续可用，页面显示「配图这次没有生成」。
- `QWEN_IMAGE_TIER=turbo`（以及 `preview` / `draft`）才改用 `qwen-image-2.1-turbo`。评测通过之前，它不是默认。
- Seedream（`5.0-flash`）和 OpenAI GPT Image 必须把 `IMAGE_PROVIDER` 写成 `seedream` 或 `openai` 才会选中。OpenAI
  只认官方 API key，不要把 Codex 或 ChatGPT 的 OAuth 放进 Worker。
- 语音使用同一个百炼密钥。有 `DASHSCOPE_API_KEY` 或 `BAILIAN_API_KEY` 时，生成卡片会请求
  `qwen3-tts-flash`（`language_type` 为
  `Japanese`），并把可播放的音频地址写进这张卡片。没有密钥时不发请求，卡片上也不留播放占位。语音这一次失败时卡片继续可用，同样不显示播放钮。有可播放地址时才显示圆形播放钮。不会请求
  MiniMax。火山生图也不在请求路径上。语音没有词级时间戳，也不做强制对齐。
- 生卡时如果 kuromoji 分词成功，会把 `reading_tokens` 写进这张卡片。每一项是 `surface`、可选的 `reading`，以及
  `moraWeight`：假名和长音各算一拍，拗音小字不算，标点权重为 0 并并入相邻的词。分词失败只记
  `[reading] tokenize failed`，卡片照常保存，这一列为空。播放用 TodayCard 上的那一个圆形播放钮。`audio.duration`
  出来之后，按 mora 权重把整段时长线性分给各词，`timeupdate`
  时高亮当前词，读音行能对上时一起高亮。没有分词、没有时长，或是迁移前的旧卡片，句子保持原样，不高亮。
- 通义生图发请求前先走 `QwenImageLimiter`，大约每分钟 20 次。预览模型也走这个上限。

## 本地启动

在仓库根目录：

```bash
pnpm install
cp packages/backend/.dev.vars.example packages/backend/.dev.vars
```

把 `.dev.vars` 里的 `BETTER_AUTH_SECRET` 换成一段足够长的随机字符串，不要用 `better-auth-secret-123456789`。

只在本机验证全量卡片时，把已经注册用户的 id 写进 `.dev.vars`，保存后重新运行 `pnpm dev`。不要提交真实 id：

```bash
ADMIN_USER_IDS=
```

id 可以在登录后从本地库读出来：

```bash
pnpm --filter @jpcards/backend exec wrangler d1 execute jpcards --local --command "SELECT id, email FROM user;"
```

多个 id 用英文逗号分隔。没写、留空，或 id 对不上时，`/admin/cards` 和 `GET /api/admin/cards` 返回
403。别的账号看不到「全部卡片」入口。

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
3. `pnpm --filter @jpcards/backend db:migrate:remote`。这条命令会把 `packages/backend/migrations/`
   里还没跑过的迁移应用到远程 D1，包括每日额度表 `0004_daily_card_quota.sql`、朗读分词
   `0005_card_reading_tokens.sql`，以及抽签幂等表 `0006_card_generation_idempotency.sql`。跟词高亮的代码会读取
   `reading_tokens` 列，抽签会写入幂等表，所以要在 `pnpm deploy`
   **之前**先跑远程迁移。如果新代码已经部署上去了，马上补跑一次。没迁移之前，生成和历史读取会因为缺列或缺表失败。本地
   `pnpm dev` 会自己跑 `db:migrate:local`。
4. `pnpm --filter @jpcards/backend exec wrangler secret put BETTER_AUTH_SECRET`
5. 全量卡片默认关闭。要指定管理员时再执行
   `pnpm --filter @jpcards/backend exec wrangler secret put ADMIN_USER_IDS`。提示输入时填
   userId，多个用英文逗号分隔。先用
   `pnpm --filter @jpcards/backend exec wrangler d1 execute jpcards --remote --command "SELECT id, email FROM user;"`
   查出 id。不要填邮箱，不要写进 `wrangler.jsonc` 或仓库。不设置时谁都不是管理员。
6. 文本生卡需要时再放 `CHAT_API_KEY` 和 `CHAT_API_ENDPOINT`。不要放火山或 MiniMax 的假密钥。
7. 百炼密钥只通过 `wrangler secret put DASHSCOPE_API_KEY` 或 `wrangler secret put BAILIAN_API_KEY`
   写入。同一个密钥会打开配图 `qwen-image-3.0` 和日语语音
   `qwen3-tts-flash`。没有密钥时配图和语音都不会发请求。不要把密钥贴进仓库、提交或文档。Seedream、OpenAI 可以先空着。
8. `pnpm deploy`
9. 自定义域名和 HTTPS 在 Cloudflare 控制台给这个 Worker 加域名。Workers 自带的 `*.workers.dev` 已经是
   HTTPS；自己的域名要在控制台完成委派。

`BETTER_AUTH_URL` 可以不设。不设时，登录用当前请求的 origin。如果站点有固定域名，再用 secret 或 var 设成那个 `https://`
地址。

`CLOUDFLARE_API_TOKEN` 只留给你本机的 drizzle-kit，不要放进 Worker。
