# API 01：文本生成 Audio Encoded Hex String

## 1. 接口目标与场景

将输入文本转换为语音音频，并返回可直接存储或传输的十六进制编码字符串（`audioHex`）。

典型场景：

- 学习卡片的日语朗读生成
- 离线缓存语音内容
- 前端按需解码并播放

## 2. 接口定义

- **Method**: `POST`
- **Path**: `/api/audio/text-to-hex`
- **Content-Type**: `application/json`
- **Auth**: `Bearer Token`（必需）

## 3. 请求参数

### 3.1 Request Body

```json
{
  "text": "昨日は日本語を勉強していた。",
  "voice": "ja-JP-NanamiNeural",
  "format": "mp3",
  "sampleRate": 24000,
  "speed": 1.0
}
```

### 3.2 字段说明

- `text`（string，必填）
  - 要合成的文本内容
  - 长度：`1..2000` 字符
- `voice`（string，必填）
  - 音色标识（由服务端支持列表决定）
- `format`（string，必填）
  - 允许值：`mp3`、`wav`、`opus`
- `sampleRate`（number，选填）
  - 允许值：`16000`、`22050`、`24000`、`44100`
  - 默认值：由 `voice` 与 `format` 组合决定
- `speed`（number，选填）
  - 语速倍率，范围：`0.5..2.0`
  - 默认值：`1.0`

## 4. 成功响应

- **Status**: `200 OK`

```json
{
  "requestId": "req_01HTTSHEX9J7Z5",
  "audioHex": "4944330400000000000F544954320000000500000003E382...",
  "audioFormat": "mp3",
  "sampleRate": 24000,
  "durationMs": 1830,
  "sizeBytes": 54920,
  "sha256": "2e7d2c03a9507ae265ecf5b5356885a53393a2029d241394997265a1a25aefc6"
}
```

### 4.1 响应字段说明

- `requestId`：请求追踪 ID
- `audioHex`：音频二进制内容的十六进制编码字符串（小写，无 `0x` 前缀）
- `audioFormat`：实际生成格式
- `sampleRate`：实际采样率
- `durationMs`：音频时长（毫秒）
- `sizeBytes`：原始音频字节数（编码前）
- `sha256`：原始音频字节内容摘要，用于缓存与一致性校验

## 5. 失败响应与错误码

统一响应结构：

```json
{
  "error": {
    "code": "INVALID_TEXT",
    "message": "text must be between 1 and 2000 characters",
    "requestId": "req_01HTTSHEX9J7Z5"
  }
}
```

错误码建议：

- `INVALID_TEXT`：文本为空或超长
- `UNSUPPORTED_VOICE`：音色不支持
- `UNSUPPORTED_FORMAT`：输出格式不支持
- `INVALID_SAMPLE_RATE`：采样率非法
- `INVALID_SPEED`：语速超出范围
- `RATE_LIMITED`：请求频率受限
- `UPSTREAM_TTS_FAILED`：上游语音服务失败
- `UNAUTHORIZED`：鉴权失败
- `INTERNAL_ERROR`：服务内部错误

推荐状态码映射：

- `400`：参数错误类
- `401`：未授权
- `429`：限流
- `502`：上游依赖失败
- `500`：服务内部错误

## 6. 校验规则与实现约束

- `audioHex` 必须是偶数长度，仅包含 `[0-9a-f]`。
- 服务端必须记录 `requestId` 与上游耗时，用于排障与审计。
- 对相同参数请求可启用缓存，缓存键建议：
  - `sha256(text + voice + format + sampleRate + speed)`
- 超长文本建议分段合成（本接口暂不自动分段，超长直接报错）。

## 7. 安全与合规

- 不记录完整输入文本与音频内容到普通日志。
- 日志中 `audioHex` 仅允许记录前后片段（例如前 16/后 16 字符）用于排障。
- 若文本可能包含敏感信息，调用方需在入参前执行脱敏策略。

## 8. 版本与变更记录

- `v1.0`（2026-02-12）：初版接口定义，返回 `audioHex` 与基础元信息。
