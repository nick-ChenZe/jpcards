# 开发、配置与部署

依赖锁文件使用 pnpm 8；以下命令使用 pnpm 8.15.9（本机没有此版本时，将 `pnpm` 换成
`npx --yes pnpm@8.15.9`）。当前项目已用 Node.js 24 验证。

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

部署现有站点时复用已经配置的资源和密钥；新环境按需完成以下步骤：

1. 使用已授权的 Cloudflare 连接，或在本机 `wrangler login`，也可以使用有 Workers 和 D1 权限的 API token。
2. 当前 `wrangler.jsonc` 已绑定现有生产 D1。部署现有站点时保留此绑定；仅新建独立环境时创建新的 D1 并填入它的 database
   id。
3. `pnpm --filter @jpcards/backend db:migrate:remote`。这条命令会把 `packages/backend/migrations/`
   里还没跑过的迁移应用到远程 D1，包括每日额度表 `0004_daily_card_quota.sql`、朗读分词
   `0005_card_reading_tokens.sql`、抽签幂等表 `0006_card_generation_idempotency.sql`，以及注册限流
   `0007_register_rate_limit.sql`。跟词高亮的代码会读取 `reading_tokens` 列，抽签会写入幂等表，注册限流会读写
   `register_rate_limit`。所以要在 `pnpm deploy`
   **之前**先跑远程迁移。如果新代码已经部署上去了，马上补跑一次。没迁移之前，生成和历史读取会因为缺列或缺表失败，注册会因为缺少
   `register_rate_limit` 返回 503。本地 `pnpm dev` 会自己跑 `db:migrate:local`。
4. `pnpm --filter @jpcards/backend exec wrangler secret put BETTER_AUTH_SECRET`
5. 全量卡片默认关闭。要指定管理员时再执行
   `pnpm --filter @jpcards/backend exec wrangler secret put ADMIN_USER_IDS`。提示输入时填
   userId，多个用英文逗号分隔。先用
   `pnpm --filter @jpcards/backend exec wrangler d1 execute jpcards --remote --command "SELECT id, email FROM user;"`
   查出 id。不要填邮箱，不要写进 `wrangler.jsonc` 或仓库。不设置时谁都不是管理员。
6. 文本生卡需要时再放 `CHAT_API_KEY` 和 `CHAT_API_ENDPOINT`。火山和 MiniMax
   不是上线必选，不要为了凑清单去放这两家的密钥。
7. 百炼密钥只通过 `wrangler secret put DASHSCOPE_API_KEY` 或 `wrangler secret put BAILIAN_API_KEY`
   写入。同一个密钥会打开配图 `qwen-image-3.0` 和日语语音
   `qwen3-tts-flash`。没有密钥时配图和语音都不会发请求。不要把密钥贴进仓库、提交或文档。Seedream、OpenAI 可以先空着。
8. 先执行 `pnpm --filter @jpcards/frontend build` 和 `pnpm --filter @jpcards/backend prepare:assets`，再执行
   `pnpm --filter @jpcards/backend exec wrangler deploy --keep-vars`，保留线上 vars。
9. 自定义域名和 HTTPS 在 Cloudflare 控制台给这个 Worker 加域名。Workers 自带的 `*.workers.dev` 已经是
   HTTPS；自己的域名要在控制台完成委派。

`BETTER_AUTH_URL` 可以不设。不设时，登录用当前请求的 origin。如果站点有固定域名，再用 secret 或 var 设成那个 `https://`
地址。

`CLOUDFLARE_API_TOKEN` 只留给你本机的 drizzle-kit，不要放进 Worker。

日配额、百炼配图和语音的粗算费用、谁可以改 secrets，以及只写在纸上的人工查看线，见
[费用、配额和密钥](cost-and-quota.md)。没有费用仪表盘，也没有自动 pager。
