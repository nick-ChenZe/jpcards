# 代码评审：jpcards `main`（`6269236`）

评审日期：2026-10-24。对象是公开仓库当前 `main`，不是某次局部 diff。

结论先说清楚：**这套代码不能对公网开放注册。**
登录页、生卡函数和历史页都有原型，但它们不在同一个可部署的运行时里。认证密钥、Cookie 域名和邮件验证没有接到 Cloudflare
绑定上。任意注册用户（以及利用顶层导航带着 Cookie 访问 `GET /api/card` 的第三方页面）都可以无上限打到
DeepSeek、火山引擎和 MiniMax。

本文件只记录缺陷和修法。重启后的范围、issue 拆分和第一轮任务在 [RESTART_PLAN.md](./RESTART_PLAN.md)。

本次 PR 不改业务代码。下面的 P0 要动 Worker 绑定、会话配置和生成状态机。在没有 `wrangler`
配置的仓库里塞一个半截补丁，无法验证，还会制造第三套配置方式。

## 范围与核对方式

读过的主路径：`packages/backend/src`（Hono
入口、better-auth、生卡、历史、D1、R2、火山签名、MiniMax、romaji）、`packages/frontend/src`（路由、登录注册、探索、历史）、`packages/shared`、根脚本、`.gitignore`、drizzle
迁移，以及 `6269236` 删掉的 `docs/product/*`。

另外核对了 GitHub：

- 真正的 open issue 只有 [#1](https://github.com/nick-ChenZe/jpcards/issues/1)（`.DS_Store`）。`.gitignore`
  已有该规则，迁移提交已删除 `packages/.DS_Store`。这个 issue 是过期的。
- [#2](https://github.com/nick-ChenZe/jpcards/pull/2) 和 [#3](https://github.com/nick-ChenZe/jpcards/pull/3) 是草稿
  PR。Issues API 会把 PR 算进 “open issues”，不要按三个需求来排期。
- 产品文档（brief、PRD v0.2、路线图、build spec、记忆系统设计、决策日志）在 `6269236`
  被整目录删除。下文对产品差距的判断来自该提交的父版本，本 PR 不把旧文档原样恢复。

没有跑通集成测试：仓库里没有可用密钥，也没有 `wrangler dev`
入口。能在静态阅读里确定的事情，下面按确定来写；依赖厂商真实响应的，标成未证实。

严重度：

| 级别 | 含义                                                                       |
| ---- | -------------------------------------------------------------------------- |
| P0   | 公开注册上线前必须修。不修就会资损、会话不可用，或核心路径在 Worker 上失败 |
| P1   | 第一批用户会碰到的正确性或契约问题                                         |
| P2   | 上线后会立刻拖慢迭代                                                       |
| P3   | 卫生问题。不要为此单独开一轮重构                                           |

## 公开注册改变了哪些结论

所有者已决定：第一批用户是公开注册，不是邀请制。因此下面几件事从“上线前再补”变成 P0：

1. 注册、登录、生卡都要有**跨 isolate 有效**的限流。better-auth 1.3.25 只在 `NODE_ENV===production` 时开启内置限流，窗口
   10 秒、最多 100 次，存储是进程内存。Worker 通常不设这个变量，所以限流是关的；就算打开，每个 isolate 也各算各的。
2. 未验证邮箱的会话不能调用付费生卡。当前 `emailAndPassword` 只写了 `enabled: true`，没有
   `requireEmailVerification`，也没有发信函数。假邮箱可以注册完立刻打模型。
3. `BETTER_AUTH_SECRET`、`baseURL`、`trustedOrigins`、`Secure` Cookie 必须来自部署环境，不能写死
   `http://localhost:5173`。
4. 生卡要有用户日配额和全局熔断，并且在调用三家厂商**之前**占坑。
5. HTTP 错误体只返回稳定错误码。上游原文、SQL、D1 HTTP body 只进日志。

邀请制可以靠“人少”暂时遮住这些洞。公开注册不能。

## P0

### P0-1 迁移提交没有产生可部署的 Worker

`feat: migrate deploy to cloudflare`（`6269236`）把 Express 入口 `packages/backend/index.ts` 删了，换成 Hono 的
`packages/backend/src/index.ts`，并假定存在绑定 `DB`、`R2`、`ASSETS`（`packages/backend/src/types.ts` 的
`Env`）。仓库里没有 `wrangler.toml` / `wrangler.jsonc`，没有 `[assets]`，没有 SPA `not_found_handling`，没有 secrets
声明。

请求路径仍然读 Node 的 `process.env`：

- `packages/backend/src/config/index.ts` 在模块加载时把 `CHAT_API_KEY`、火山 AK/SK、MiniMax、以及 `CLOUDFLARE_API_TOKEN`
  收进 `config.env`。
- `packages/backend/src/routes/card.ts` 顶层 `new OpenAI({ apiKey: config.env.chatApiKey, ... })`。生卡路由虽然把
  `c.env` 传进 `buildCardWithMemory`，但只用它做 R2 和 `S3_PUBLIC_URL`。LLM、生图、TTS 都不读绑定。
- `packages/backend/src/routes/auth.ts` 写的是 `import {Env} from 'src/types.js'`。这依赖 `tsconfig` 的
  `baseUrl`。Wrangler 的 esbuild 不读这个 paths，打包会直接失败。同文件其它 import 已经是相对路径。

本地也起不来。`packages/backend/package.json` 的 `start` 仍是 `node --loader ts-node/esm index.ts`，该文件已删除。Hono
应用只 `export default app`，没有 `listen`。前端 `packages/frontend/vite.config.ts` 把 `/api` 代理到
`localhost:8000`，没有进程听这个端口。

Worker 运行时还会撞上 Node 专用模块：`querystring`（`utils/volc.ts`）、`axios` 和
`crypto`（`utils/minimax.ts`、`database/cardHistory.ts`、`database/sentenceMemory.ts`）、`@aws-sdk/client-s3`（`utils/r2.ts`）、kuromoji
的词典文件（`utils/romaji.ts`）。打开 `nodejs_compat` 不能代替把这些调用改成绑定和 Web API。

修法：新增 `wrangler.jsonc`（D1、R2、ASSETS、SPA 回退、`compatibility_date`）。请求路径只接受 `c.env`。`config` 变成
`getConfig(env)`，禁止模块顶层读 `process.env` 去创建客户端。`auth.ts` 改成相对 import。`pnpm dev` 定义为
`wrangler dev`，Vite 代理到 Wrangler 的本地端口。drizzle-kit 用的账号 token 留在开发者本机环境，不进 Worker。

### P0-2 认证走 D1 绑定，学习数据走账号级 HTTP API

`auth()` 使用 `drizzle(env.DB)`（`packages/backend/src/routes/auth.ts`）。句子记忆和卡片历史使用
`packages/backend/src/database/d1Client.ts`：用 `CLOUDFLARE_API_TOKEN` 调用 `api.cloudflare.com` 的 D1 REST
`/query`，再把 JSON 对象 `Object.values` 成 drizzle sqlite-proxy 的行。

这是两套库、两套失败模式：

- Worker 上通常没有 `process.env.CLOUDFLARE_API_TOKEN`。结果是登录也许能查绑定，生卡和历史在拼出
  `accounts/undefined/d1/database/undefined` 后失败。
- 这个 token 一般具备账号级 D1 权限。放进 Worker 后，任意代码或日志泄漏都比一个数据库绑定严重。
- REST 行序不保证等于 sqlite-proxy 要的列序。`get` / `all` 现在靠对象键顺序碰运气。
- 一次生卡至少四次 SQL（读记忆、写记忆、插历史、更新 URL），每次都是出站子请求，再叠加 LLM、生图轮询和 TTS。

修法：`cardHistory.ts` 和 `sentenceMemory.ts` 接受 `env.DB` 上的 drizzle 实例，删掉运行时 REST
客户端。`CLOUDFLARE_API_TOKEN` 只出现在本机 `drizzle-kit` 配置。账号 token 一旦进过 Worker secret，轮换它。

### P0-3 公开注册的会话配置不成立

`auth()` 的有效配置只有：邮箱密码、`trustedOrigins: ['http://localhost:5173']`、username 插件。`.env.template` 里有
`BETTER_AUTH_SECRET`，`Env` 类型和 `auth(env)` 都没有把它传进去。better-auth 读的是
`process.env.BETTER_AUTH_SECRET`，不是绑定。

对照的是锁文件里的 better-auth 1.3.25（`packages/better-auth/src/init.ts`）。`secret` 的取值顺序是
`options.secret`、`process.env.BETTER_AUTH_SECRET`、`process.env.AUTH_SECRET`，然后是源码常量
`better-auth-secret-123456789`。缺密钥时不会拒绝启动。只有 `NODE_ENV===production` 才打一条 error
日志，请求继续用这把公开密钥签名。Workers 默认没有这个 `NODE_ENV`，于是公开注册的会话签名密钥是已知的。

`trustedOrigins` 那一行也不可靠。`getTrustedOrigins` 在初始化时如果解析不到 `baseURL`（没有传入，也没有
`BETTER_AUTH_URL`），直接返回空数组，`http://localhost:5173` 不会进入校验列表。带 Cookie 的认证 POST 会因为 Origin
对不上而 403。反过来，一旦只配置了正式域名的 `baseURL`，localhost 仍会被追加进生产信任列表。没有显式 `useSecureCookies`
/ `SameSite`。前端 `packages/frontend/src/lib/auth.ts` 的 `createAuthClient()` 也没有 `baseURL`，完全赌同源。

邮件验证缺失，见本节开头。密码长度没有写在本仓库的配置里，实际落到库默认的最短 8 位、最长 128
位，注册页没有提示。`packages/frontend/src/components/LoginForm.tsx` 把 `res.error.message` 原样
toast，注册接口同样。这会把“用户已存在”和内部错误直接给浏览器，也方便撞库脚本枚举账号。

忘记密码是 `href="#"`。登录成功后算出了 `from`，实际却 `navigate('/')`，回跳是死的。

旧 Express 入口曾经对 `/api/card` 整段跳过 session。现在的 Hono 中间件对 `/api/*` 要求 session，`/api/auth/`
除外（`packages/backend/src/index.ts`）。这个方向是对的，它不构成公开注册的防护。

修法：

- `secret`、`baseURL`、`trustedOrigins` 从 `env` 注入。启动时如果 secret 缺失或等于
  `better-auth-secret-123456789`，直接失败。生产 Cookie 显式 `Secure` + `SameSite=Lax` + `HttpOnly`。开发 origin 和正式
  origin 分环境配置，不要写死在源码里。
- `requireEmailVerification: true`，并实现 `sendVerificationEmail`。未验证会话访问生卡返回 403，且不调用厂商。
- 注册、登录、验证信、生卡使用 D1 或 KV 里的计数器限流（按 IP 和按账号）。不要用 isolate 内存。
- 登录失败返回统一文案。日志里再记 better-auth 的原始原因。
- 在邮件通道接通之前，用显式开关关掉生卡（例如 `CARD_GEN_ENABLED=false`），而不是先让公开注册打到厂商。

### P0-4 生卡是无配额、带副作用的 GET

`GET /api/card`（`packages/backend/src/index.ts`）在一次请求里调用 DeepSeek、火山生图和 MiniMax，并写两张表、传两份
R2。前端 `ExplorePage` 和未使用的 `Welcome.tsx` 都是 `fetch('/api/card')`。

公开注册下这是账单口子：

- 没有任何用户日配额、并发锁或全局熔断。脚本注册一批账号即可线性烧三家 API。
- `SameSite=Lax` 的会话 Cookie 会在跨站**顶层 GET** 上送出。恶意页面把已登录用户导航到 `/api/card`
  就能触发生成。better-auth 只保护自己的 POST，不保护这个自定义 GET。
- 浏览器、预取和重试都会重放 GET。没有 `Cache-Control: no-store`，也没有幂等键。
- 失败响应把 `error.message` 返回客户端（见 P0-5）。厂商报错里可以带请求细节。

`generateImageBuffer` 固定轮询 10 次、间隔 1.5 秒，失败原因不区分“还在排队”和“鉴权失败”。加上 LLM 与
TTS，同步请求很容易顶到 Worker 的请求时长。用户看到失败时，上游费用可能已经发生。

修法：改成 `POST /api/card`，要求 `Content-Type` 和同源 Origin。在调用任何厂商之前，用 D1 条件更新占住“该用户当日配额 +
单用户一个 in-flight”。超额返回 429，body 不带上游信息。全局开关和全局日上限独立于单用户配额。生图不要在同一个请求里
`sleep` 轮询：先落一条 `pending` 记录并返回卡片 id，由客户端轮询状态，或交给 Queue。`Idempotency-Key`
重复提交必须返回同一张卡，不能再打一次模型。

### P0-5 错误响应会把内部信息还给调用方

`/api/card` 和 `/api/history` 的 `catch` 都是：

```ts
return c.json({
    error: 'Failed to build card',
    message: error instanceof Error ? error.message : 'Unknown error'
}, 500);
```

`d1Client.ts` 把 D1 的 HTTP body 拼进 `Error`。MiniMax 把 `status_msg` 拼进 `Error`。火山把 `response.message` 拼进
`Error`。这些字符串现在会进入 JSON。公开用户和扫描器都能看到。

修法：对外只保留稳定 `code`（如 `CARD_GENERATION_FAILED`、`QUOTA_EXCEEDED`、`EMAIL_UNVERIFIED`）。`console.error`
或结构化日志保留原因、用户 id、卡片 id。禁止把 `error.message` 放进响应。前端不要把 500 body 当作用户文案；`ExplorePage`
现在只展示 status，这个习惯保持住，同时不要再读取 `message`。

## P1

### P1-1 生卡失败后留下半成品，也没有幂等

`buildCardWithMemory`（`packages/backend/src/routes/card.ts`）的顺序是：

1. 读最近句子，调用 LLM。
2. `insertSentence`（冲突则 `onConflictDoNothing`，然后继续）。
3. 做注音。
4. 并行生图和 TTS。任一步失败，整次失败，但句子已经记入“已学过”。
5. `insertCardHistory`（此时还没有音频和图片 URL）。
6. `env.R2.put` 两份对象，再 `head` 验证。
7. `updateCardAssets`。

中途失败的用户可见后果：历史里出现没有媒体的卡片；重试会再付一次费，并让模型躲开刚才那句其实没学成的句子。两个并发请求会读到同一份记忆，生成重复句子，并各付各的。`task_id: card-${Date.now()}`
在同一毫秒会撞车。函数最后仍把整图和整段音频做成 data URL 返回，R2 副本只服务历史页。响应体积和 Worker
内存都被放大（音频还先变成 hex 字符串）。

修法：一张卡一条状态：`pending | ready | failed`。配额和幂等键先占坑。厂商全部成功后再把状态改成 `ready` 并写入
URL。失败写入 `failed` 和内部原因，不把句子放进“已学过”，或允许同一句重试。历史列表默认只返回 `ready`。响应给探索页的是
R2 的 URL，不再内嵌 base64。`head` 在 `put` 成功之后是多余的子请求。

### P1-2 模型输出没有边界就进入付费接口

系统提示要求“只输出一句日语”，代码只做了 `trim`
和一次首尾引号剥离（`/^["']|["']$/g`，去不掉「」和多行解释）。没有最大长度，没有“必须含假名/汉字”的检查，也没有拒绝解释性中文。超长或跑偏的文本会原样进入火山和
MiniMax。难度写死 `N5`，调用方不能选，也没有人校验生成结果是否像 N5。

修法：在付费调用前做硬限制（例如 80 个字符以内、单行、含日文、不含换行说明）。不合格就重试一次 LLM，第二次仍失败则返回
`CARD_GENERATION_FAILED`，不产生句子记忆。等级仍然可以内部固定为 N5，但要写在测试里，避免提示词和常量各改各的。

### P1-3 注音失败会被缓存成永久降级

`toSentenceWithKanjiRomaji` 用进程级 `tokenizerPromise`。第一次没有 `dicPath`、词典 404，或 `import()` 失败时，promise
resolve 成 `null`，之后这个 isolate 上的所有请求都不再尝试。`getDicPath` 在 `import.meta.url` 以 `file:` 开头时忽略
`assetsBaseUrl`，改去读 `node_modules/kuromoji/dict`。打包后的 Worker 经常仍是 `file:` URL，于是永远走不到 XHR polyfill
那条词典 URL。

根 `.gitignore` 的规则 `public` 忽略所有名为 `public` 的目录。`prepare:assets` 复制到 `public/kuromoji` 的词典不会进
git。`packages/frontend/public/vite.svg` 是规则加上之前已经跟踪的文件，所以还在。新的静态资源默认加不进去。

注音 HTML 目前经过 `escapeHtml` 再被 `ExplorePage` / `HistoryPage` 用 `dangerouslySetInnerHTML`
渲染。以今天的写入路径，XSS 没有直接开口。存储的是 HTML 而不是句子结构，后面任何一条不转义的写入都会变成存储型 XSS。

修法：词典随构建产物发布，不依赖被 ignore 的目录。tokenizer
初始化失败不要缓存，或只缓存成功结果。中期把注音数据换成结构化 token，前端用 `<ruby>` 渲染，数据库不再存 HTML。

### P1-4 `packages/shared` 描述的是另一个产品

`packages/shared/index.d.ts` 的 `Card` 是 `id: number`，外加
`japanese`、`reading`、`meaning`、`difficulty: Easy|Normal|Hard`。运行中的接口返回
`id?: string`、`sentence`、`sentenceHtml`、`imageDataUrl`、`audioDataUrl`。历史项又是第三种形状，还带
`userId`、`audioUrl`、`illustrationUrl`。

后端 `package.json` 依赖 `@jpcards/shared`，源码没有 import。前端不依赖 shared，在
`ExplorePage.tsx`、`Welcome.tsx`、`HistoryPage.tsx` 各写一份 interface。`useChat.ts` 请求
`POST /api/chat/stream`，后端没有这个路由。聊天是已删除的产品形态留下的客户端。

修法：在 shared 里定义当前真实的 `Card`、`HistoryPage`、`ApiError`，前后端都从这里 import。删掉或隔离
`useChat`，直到真的有解释接口。shared 补上 `exports`，避免只有一个裸 `types` 字段。

### P1-5 测试和 CI 挡不住这次回归

根 `package.json` 的 `test` 是 `echo "Error: no test specified" && exit 1`。没有 `.github/workflows`。前端没有测试脚本。

后端 vitest 里，romaji 是唯一不花钱的单测。`card.test.ts`、`minimax.test.ts`、`r2.test.ts`
都是有密钥才跑的真实厂商调用。`card.ts` 在 import 时就 `new OpenAI`。干净 CI 没有 `CHAT_API_KEY` 时，失败发生在
`it.runIf` 之前，用例不会被跳过，整个文件加载失败。没有任何测试覆盖：未登录 401、未验证邮箱 403、配额、错误体不含
`message`、历史分页、句子 hash、生成中途失败不写“已学过”。

修法：根 `test` 改成递归执行各包的 hermetic 测试。CI 跑 `dprint check`、`tsc`、这些测试。厂商调用移到显式的 nightly
job，默认 PR 不跑。P0 的中间件和配额用假的 `Env` 测。

## P2

### P2-1 仓库同时留着 Node 服务、S3 SDK 和 Worker 绑定三套存储

`utils/r2.ts` 的 S3 客户端只被集成测试使用。生卡路径用的是 `env.R2`。`buildR2Url` 把 endpoint 再拼一次 bucket 主机名，和
`S3_PUBLIC_URL` 不是同一套 URL。`routes/image.ts`、`routes/audio.ts` 整文件注释掉了，校验函数还在，但没有挂到 Hono
上。`gpt-tokenizer`、大量 `shadcn-io/ai/*`、`hocs/withAuth.tsx`、空的 `hocs/Auth.ts`、`Welcome.tsx` 没有被 `App.tsx`
使用。`wrangler` 放在 dependencies 而不是 devDependencies。

这些不是风格问题：下一次修生卡的人无法判断哪条路径才是生产路径。P0 的绑定改造做完后，删掉请求路径上达不到的 S3
客户端和注释路由。UI 组件库等功能真的回来再留。

### P2-2 迁移方言是两套的

`src/database/sql/migrations/*.sql` 和 `sql/better-auth_migrations/*.sql` 是 MySQL / `VARCHAR` / `timestamp(3)`
写法。drizzle 的 `drizzle/0000_strong_firebrand.sql` 是 SQLite，时间戳混用 integer 和
`text DEFAULT CURRENT_TIMESTAMP`。应用表 `sentence_memory`、`card_history` 没有指向 `user.id`
的外键，删用户不会级联学习数据。`created_at` 是 SQLite 的 UTC 文本，历史页 `new Date(dateStr)`
在浏览器里按本地时区解析无时区字符串，展示会偏。

修法：只保留 drizzle 迁移作为 D1 的来源，把 `src/database/sql` 标成归档或删除。补外键。时间统一存 unix 毫秒或带 `Z` 的
ISO 字符串。

### P2-3 火山签名没有在仓库里被证明可用

`utils/volc.ts` 的签名头只有 `X-Date`。`utils/auth.ts` 的 `getSignHeaders` 会把 `host`
列入允许签名的名字，但调用方从未设置 `Host`，所以规范串里没有 host。火山引擎 HMAC 文档要求签名包含
host。当前只有“配了密钥才跑”的集成测试，CI 从未执行。公开上线前要用固定时钟和固定 body 做矢量测试，并在 Worker
运行时打一次沙箱，确认不是 Node `querystring` 碰巧能用。

`utils/minimax.ts` 的 `downloadAudioAsBuffer` 会 `fetch` 响应里的 `audio_url` / `audio_file`。URL
来自厂商而不是用户，仍应限制主机名，避免异常响应把 Worker 变成开放代理。

### P2-4 和已锁定的学习产品之间还隔着一整层

父提交里的 PRD
锁定的是：中文用户、每日队列、词卡和句卡、回忆评分、间隔重复、按天的学习历史、卡片中文释义。代码里的“历史”是生卡媒体日志，没有释义、没有对错、没有复习时间。好友页和设置页是占位。等级不能选。这个差距本身不是
bug，但它说明 **当前 main 不是 PRD v0.2 的半成品，而是一条旁路原型。** 重启计划按旁路原型的真实能力裁 MVP，而不是宣布旧
PRD 已经做完。

前端还有几处会直接打到第一批用户：`index.html` 标题仍是 `frontend`，字体走 Google
Fonts（国内网络不稳定），界面中英混杂，登录页没有密码长度提示。

## P3

一次性清掉即可，不要单独立项重构：

- 根 `package.json` 的 `main` 指向不存在的 `index.js`，没有 `packageManager` 字段。
- 根 README 是空文件。草稿 PR #2、#3 在产品范围重新写定之前不要合并。
- issue #1 可以关。
- `LoginForm` 的成功 toast 是 `"  signed in"`。
- 历史分页用 `Number(query.page) || 1`，非整数字符串会变成 `NaN` 再回落，小数会留下。收成整数并封顶即可。
- 生图结果固定标成 `image/png`。若上游是 JPEG，个别客户端会拒绝。以响应魔数决定 content-type。
- `card_history` 把 `userId` 回给前端。这是当前用户自己的 id，风险低。响应里去掉，避免以后被抄进日志。

## 建议的前五项

顺序和 [RESTART_PLAN.md](./RESTART_PLAN.md) 的第一轮一致。

1. **先让 Worker 能启动，再谈功能。** 补 `wrangler.jsonc`，请求路径全部改读 `c.env`，学习数据改走 `env.DB`，账号级 API
   token 离开 Worker。
2. **按公开注册加固认证。** secret、`baseURL`、`trustedOrigins`、Secure Cookie、邮箱验证、D1/KV
   限流。邮件没通之前，生卡开关保持关闭。
3. **把 `GET /api/card` 换成有配额、有幂等键、错误体不带上游原文的 POST。** 未验证用户和超额用户不能打到三家厂商。
4. **用 shared 写死现在的卡片和历史契约**，删掉不存在的 `/api/chat/stream` 客户端。注音失败不许缓存成永久 `null`。
5. **让根目录 `pnpm test` 在 CI 里跑 hermetic 测试**，覆盖 401、未验证 403、配额和错误体。厂商集成测试移出 PR 必跑路径。
