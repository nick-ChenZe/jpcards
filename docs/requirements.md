# 产品需求与行为约定

日札是一款每日一句的日语学习应用。视觉与动效见 [界面规范](hiyori-ui.md)，开发部署见
[开发说明](development.md)。本文记录需要保留的业务行为；新增或变更需求时在这里同步。

## 页面与学习流程

- 今日：日期、连签和余签印记，抽签、等待进度、完成后的图文日签。首页不放日历。
- 回访轻对照只在「昨天有日签、今天还没抽」时出现：未抽纸签上方一块约半张墙砖高的矮纸砖，眉标「昨日」，日文最多两行。没有昨天则不渲染。今天已经抽过（含这次生成成功，或历史里今天已有卡片）后整块卸掉，不挡抽签和阅读。不提示补签，不用朱印色，没有狐狸。数据只用已有的
  `GET /api/history?day=`。
- 日签墙：以月历为唯一主元素；点日期查看当天卡片，每页三张；点卡片看详情，返回保留日期、月份和页码。空日不伪造学习记录。
- 阅读：只展示一份日语正文；可对齐的词段显示假名注音，中文释义直接可见。播放时高亮当前词，无额外整句假名或罗马音重复行。
- 我的：切换三种纸色、退出，以及有权限时的管理入口。好友页目前为筹备状态。
- 今日抽签完成后尽量一屏内展示插画、完整正文、中文、播放和再抽按钮；先压缩插画和留白，不能靠隐藏正文解决溢出。具体验收见界面规范。

## 账户、生成、配额与存储

- 注册、登录、退出。
- 历史只返回当前登录用户的卡片。点开一条可以查看这一张。看历史不扣生成次数。
- 月历足迹数据不建新表。`GET /api/me/heatmap?from=&to=` 需要登录，把当前用户 `card_history.created_at`
  按北京时间自然日聚合，和连签共用 `shanghaiDayKeyFromStored`。`from`、`to` 是
  `YYYY-MM-DD`。都不传时，默认含今天在内往前 84 天（12 周）。只传一端时，另一端补到今天，或从结束日再往前 83
  天。含首尾最多 400 天。响应是 `{day, count}[]`，只含抽过的日子，按日期升序。没有的日子前端当
  0，断开的日子不补色。接口不算浓淡。
- 前端墨阶只认五档：0 为纸洗；1 张 `#E8E0D4`；2 张 `#C4B8A8`；3 张和 4 张 `#8A7E72`；5 张及以上
  `#2C2420`。今天以朱红圈标记。点有墨的日子打开
  `GET /api/history?day=YYYY-MM-DD`，这一天的墙卡；空日写「这天还没抽」。不带 `day` 时历史仍是原来的全部卡片。

- 全量卡片只认 Worker secret `ADMIN_USER_IDS`（英文逗号分隔的 userId），默认关闭。secret 没设、为空，或当前登录的
  `user.id` 不在名单里时，`GET /api/admin/cards` 返回 403，并且不查库。邮箱不算管理员。`GET /api/me` 只多一个布尔字段
  `isAdmin`，不返回名单。设置页只在 `isAdmin` 为真时显示「全部卡片」。`/api/history`
  始终只返回自己的卡片，管理员也不例外。这个接口只读。每次成功的列表请求在日志里记
  `adminId`、`timestamp`、`resultCount`，不记卡片内容。
- 每个登录用户每天可以生成 20 张卡片，按北京时间零点重置。只有卡片生成并保存成功才扣 1
  次，配图和语音算在同一次里，不另扣。生成失败不扣当天次数。两次生成至少间隔 5
  秒。用完后探索页按钮不可点，按钮保持通栏，文案就是「今日额度已用完，明天 0
  点（北京时间）再来」，不收进小圆钮。余签印仍显示剩余枚数，用尽时面额写「0」、不补成「00」，并带
  `data-exhausted`。已知用尽时再点不发请求，也不把眼前的日签换成抽签中；服务端先返回额度 429
  时同样停住。还有次数时，在日期旁用「余签 x 枚」小印记显示，按钮下不重复展示。`GET /api/me/quota` 返回
  `{limit, used, remaining, resetsAt}`。
- `POST /api/auth/sign-up/email` 对同一个 IP、同一个邮箱各做 10 分钟短窗限制，窗口从该键第一次尝试起算，各最多 5
  次。超限返回 429，正文只有「注册太频繁，请稍后再试。」，不写密钥、堆栈，也不说明是 IP
  还是邮箱被拦住。校验失败同样计数，不退回。登录不走这条限制。IP 只认 `CF-Connecting-IP`。计数在 D1 表
  `register_rate_limit`（迁移 `0007_register_rate_limit.sql`）。数字写在
  `packages/backend/src/auth/registerRateLimit.ts`，没有单独的环境变量。
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

## 生成体验

- 等待过程使用服务端实际返回的三个阶段，显示已等待时间与明确标注的预估时间，不编造模型内部百分比。
- 「抽签中」按钮以 SVG 笔画依序书写；减少动态效果偏好下直接显示完整文字。
- 成功图片解码后以约 2.4 秒的晕染展开，不在加载完成前播放揭图动画。配图失败时正文仍可读。
- 正式生图保持 qwen-image-3.0、1024×1024、关闭
  prompt_extend；图像为和纸水彩、低饱和色、底部留白，不生成文字。语音与插画并行请求。

## 需求变更时的验收

真实登录与权限、额度仅成功扣减、失败回退、旧卡兼容、日签阅读不截字，均是持续约束。涉及哪一项就验证哪一项；费用与限流细节见
[费用和配额](cost-and-quota.md)。
