# 费用、配额和密钥

公开注册之后，成本靠日配额和配图开关卡住，不靠自动告警。本文是上限和人工查看说明。没有费用仪表盘，也没有 pager。

查阅百炼标价的日期是 2026-10-25。标价会变，以控制台为准：

- [模型价格](https://help.aliyun.com/zh/model-studio/model-pricing)
- [qwen-image-3.0](https://docs.bailian.console.aliyun.com/zh/model-studio/qwen-image-3-0)
- [qwen3-tts-flash](https://docs.bailian.console.aliyun.com/zh/model-studio/qwen3-tts-flash)

现网地域按代码里的北京域名 `dashscope.aliyuncs.com` 估算。下面是华北 2（北京）原价，不含活动折扣。

## 日配额

每个登录用户每天最多成功生成 20 张卡片，按北京时间 0 点重置。两次成功点「生成」至少间隔 5 秒。只有卡片写入历史才扣 1
次。生成失败退回这一次，看历史不扣。配图和语音算在同一次里，不另扣次数。

`GET /api/me/quota` 返回 `{limit, used, remaining, resetsAt}`。用完后接口是 429，文案是「今日额度已用完，明天 0
点（北京时间）再来」。

这 20 次和 5 秒写在 `packages/backend/src/quota/cardQuota.ts` 的
`DAILY_CARD_LIMIT`、`CARD_GENERATION_INTERVAL_MS`。没有对应的环境变量。

## 注册短窗

`POST /api/auth/sign-up/email` 在进入登录库之前计数。同一个 IP、同一个邮箱各一个窗口，从该键第一次尝试起算 10
分钟，各最多 5 次。超限是 429，正文只有「注册太频繁，请稍后再试。」，并带
`Retry-After`。响应里没有密钥、堆栈、SQL，也不说明被拦住的是 IP 还是邮箱。

校验失败也计数，不退回。这和生卡失败退款不同。登录、退出、读会话不走这条限制。

IP 只认 Cloudflare 写入的 `CF-Connecting-IP`，不认 `X-Forwarded-For`。没有这个头时仍按邮箱计数。IP 和邮箱都认不出时直接
429，避免空请求绕过。邮箱会去掉首尾空白并转成小写。计数表是 D1 的 `register_rate_limit`，迁移文件
`packages/backend/migrations/0007_register_rate_limit.sql`。表没建好时注册返回
503，文案是「暂时无法注册，请稍后再试。」，同样不把内部错误给客户端。

数字在 `packages/backend/src/auth/registerRateLimit.ts`：

| 常量                   | 值      |
| ---------------------- | ------- |
| `REGISTER_WINDOW_MS`   | 10 分钟 |
| `REGISTER_IP_LIMIT`    | 5       |
| `REGISTER_EMAIL_LIMIT` | 5       |

没有单独的 Worker 环境变量。要改次数或窗口，改这三个常量并重新部署。共享出口 IP（例如同一 NAT）在 10 分钟内最多注册 5
次。

## 一次生卡大概花多少

文本、配图、语音可以分别关掉。没有对应密钥时不发那一家的请求。

| 调用                   | 何时发生                                                                                                                                                                  | 北京地域粗算                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 文本                   | 配了 `CHAT_API_KEY` 和 `CHAT_API_ENDPOINT` 才请求。缺任何一个走本地练习卡，不花文本模型的钱。默认模型名是 `Pro/deepseek-ai/DeepSeek-V3`，单价看你填的那家，本仓库不代估。 | 随终点而定                                                                                            |
| 配图 `qwen-image-3.0`  | 有 `DASHSCOPE_API_KEY` 或 `BAILIAN_API_KEY`，且 `IMAGE_PROVIDER` 不是 `noop` / `seedream` / `openai`。请求是文生图，尺寸 `1024*1024`（1K），没有输入图。                  | 成功出图 0.18 元/张。失败不出图，按百炼规则不计费。                                                   |
| 配图 noop              | 没放百炼密钥，或 `IMAGE_PROVIDER=noop`。                                                                                                                                  | 0。不发请求。                                                                                         |
| 语音 `qwen3-tts-flash` | 同一个百炼密钥。按输入字符计费，输出音频不计费。代码里单次最多送 600 字。                                                                                                 | 0.8 元/万字符。一句练习句通常远小于 100 字，单次大约不到 0.01 元。按 600 字截满估算，单次约 0.05 元。 |
| 火山、MiniMax          | 不在请求路径上。                                                                                                                                                          | 不是上线必选项，不要为了清单去配密钥。                                                                |

配图开启时，一个用户一天的图像上限大约是 20 × 0.18 = 3.6 元。语音按短句估算通常不到 0.2 元/用户/天。100 个用户都把 20
次用满、并且每次配图都成功，图像大约 360 元/天。这是天花板，不是预测。

通义生图在 Worker 里大约每分钟 20 次（`QWEN_PRO_RPM`），和百炼北京地域该模型的 RPM 同一量级。预览档
`QWEN_IMAGE_TIER=turbo` 在评测通过前不是默认，本文的 0.18 元只对正式模型 `qwen-image-3.0`。

Seedream、OpenAI 必须把 `IMAGE_PROVIDER` 写成 `seedream` 或 `openai`
才会选中。现网默认不走这两家，本文不把它们算进日常单价。

## 谁改 secrets

线上密钥只放在 Cloudflare Worker secrets 里。能改的人，是可以对这个 Worker（`wrangler.jsonc` 里的名字 `jpcards`）执行
`wrangler secret put`，或在 Cloudflare 控制台改该 Worker Secrets 的账号。改代码、开 PR 本身不会改线上密钥。

不要把密钥写进 git、`wrangler.jsonc` 的 `vars`、issue、PR 或聊天记录。本机只放
`packages/backend/.dev.vars`，该文件不要提交。

| 名字                                              | 是否上线必填 | 作用                                                            |
| ------------------------------------------------- | ------------ | --------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                              | 必填         | 登录会话。空着或仍是公开示例值时，注册和登录返回 503。          |
| `ADMIN_USER_IDS`                                  | 可选         | 全量卡片管理员 userId，逗号分隔。不设则没有管理员。             |
| `CHAT_API_KEY`、`CHAT_API_ENDPOINT`、`CHAT_MODEL` | 可选         | 文本生卡。缺密钥或地址时用本地练习卡。                          |
| `DASHSCOPE_API_KEY` 或 `BAILIAN_API_KEY`          | 可选         | 百炼配图和日语语音。两个名字等价，放一个即可。                  |
| `IMAGE_PROVIDER`                                  | 可选         | `noop` 强制关图，即使百炼密钥还在。不设时，有百炼密钥才走通义。 |
| `QWEN_IMAGE_TIER`                                 | 可选         | 空着用正式模型。`turbo` / `preview` / `draft` 只用于预览。      |
| `SEEDREAM_API_KEY`、`OPENAI_API_KEY`              | 不必         | 只有显式选了对应 `IMAGE_PROVIDER` 才用。                        |
| 火山、MiniMax 的密钥                              | 不必         | 现网配图和语音是百炼 Qwen，不是这两家。                         |

`BETTER_AUTH_URL`、`BETTER_AUTH_TRUSTED_ORIGINS` 是地址配置，可以是 secret 或 var，不是模型密钥。`CLOUDFLARE_API_TOKEN`
只留给本机的 drizzle-kit，不要放进 Worker。

## 告警

不做自动 pager，不接电话或工单。上线后由能看百炼账单的人看控制台用量。

建议的人工查看线（不是程序阈值）：

- 配图开着时，若当天图像费用接近「当天会把额度用满的用户数 × 3.6 元」，或绝对金额到了团队能接受的日预算（可以先按 100
  元/日），把 `IMAGE_PROVIDER` 设为 `noop`，或删掉百炼密钥。配图会停，卡片和语音按各自开关继续。
- Worker 日志里大量 `Register rate limit failed`：多半是远程库还没跑
  `0007_register_rate_limit.sql`。先补迁移。不要把带堆栈的日志贴到公开频道。
- `Failed to build card` 表示这次生卡失败。失败会退回日配额。百炼是否已经计费，以控制台里成功的调用为准。

## issue #8 清单

issue #8 原来的第一条把火山（Volc）和 MiniMax 写成了生产必选密钥。现网不是这样。配图和语音是百炼 Qwen：`qwen-image-3.0`
与 `qwen3-tts-flash`。配图可以是 noop。

建议把该 issue 的完成标准改成：

- [ ] 生产密钥按需齐全：D1、`BETTER_AUTH_SECRET`；文本 `CHAT_API_KEY` / `CHAT_API_ENDPOINT` 可选；配图和语音用百炼
      `DASHSCOPE_API_KEY` 或 `BAILIAN_API_KEY`。不配百炼密钥时配图保持 noop，语音不发请求。火山和 MiniMax 不是必选。R2
      相关代码仍在仓库里，当前生卡不上传对象存储，也不把它当成必选密钥。
- [ ] 错误响应不泄露密钥或内部堆栈给客户端。
- [ ] 生卡与注册有基本速率限制。生卡是每天 20 张、间隔至少 5 秒。注册是同一 IP、同一邮箱各 10 分钟 5 次。
- [ ] 费用和配额上限写在本文。没有自动 pager。
