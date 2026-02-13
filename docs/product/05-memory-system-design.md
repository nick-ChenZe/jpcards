# 记忆系统设计草案 v0.1

本文档为日语学习 App 设计一套轻量级记忆系统，用于避免重复相似句子、支持学习曲线，并在生成下一句时利用历史记忆。

---

## 1) 日语语法等级与学习曲线

### 1.1 JLPT 等级体系（日本语能力测试）

日语有成熟的等级体系，最常用的是 **JLPT**（日本语能力测试）的 N5～N1：

| 等级 | 难度 | 典型语法覆盖 |
|------|------|--------------|
| **N5** | 入门 | 基础句型、动词变形（现在/过去/否定）、助词（は・が・に・で・を）、形容词、简单疑问 |
| **N4** | 初级 | 进阶句型、复合表达 |
| **N3** | 中级 | 过渡级，更复杂语法 |
| **N2** | 中高级 | 报纸、工作场景常见表达 |
| **N1** | 高级 | 学术、专业场景 |

- N5 约 80–100 个语法点，适合初学者。
- PRD 目前将「JLPT level selection in onboarding」放在 Out of Scope，但可以在**内部**用等级作为生成难度/语法的参考，不暴露给用户。

### 1.2 学习曲线建议（简化版）

初期不必实现完整 JLPT  syllabus，可以用一个简化的「难度等级」：

```
level: 'N5' | 'N4' | 'N3' | null  // null = 让 AI 自由选择
```

- 新用户默认 `N5`。
- 后续可基于复习正确率、学习天数等，逐步解锁 `N4`、`N3`。
- 生成时把当前 level 传给 AI，并参考「已见过的句子」做去重。

---

## 2) 存储方案（v0.1 最小可行）

### 2.1 设计原则

- 一开始不复杂：单表、少量字段。
- 复用现有 SQLite，与 `conversations` / `messages` 一样。
- 支持「按用户」「按会话」两种模式（后续可扩展）。

### 2.2 核心表：`sentence_memory`

```sql
CREATE TABLE IF NOT EXISTS sentence_memory (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,              -- 用户 ID（与 auth 一致）
    sentence TEXT NOT NULL,             -- 原始日语句子
    sentence_hash TEXT NOT NULL,        -- 去重用：如 MD5(normalized) 或简单 hash
    level TEXT,                         -- 可选：N5/N4/N3
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, sentence_hash)      -- 同一用户不重复存同一句
);

CREATE INDEX idx_sentence_memory_user_created
    ON sentence_memory(user_id, created_at DESC);
```

**字段说明：**

| 字段 | 用途 |
|------|------|
| `sentence` | 真实句子，用于返回给前端、传给 AI 做「避免重复」 |
| `sentence_hash` | 归一化后 hash（如去掉标点、统一空白），用于去重 |
| `level` | 该句对应的难度等级，便于统计和后续调参 |

### 2.3 可选扩展表（后续可加）

若将来要做「按语法点」的智能调度，可增加：

```sql
-- 可选：语法点记忆（v0.2+）
CREATE TABLE IF NOT EXISTS grammar_seen (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    grammar_label TEXT NOT NULL,        -- 如 "〜ていた"
    level TEXT,
    first_seen_at DATETIME,
    review_count INTEGER DEFAULT 0,
    UNIQUE(user_id, grammar_label)
);
```

v0.1 建议**不实现**，保持简单。

---

## 3) 生成流程：如何利用记忆

### 3.1 当前流程（无记忆）

```
用户请求 → generateJapaneseSentence() → 随机一句 → 返回
```

### 3.2 新流程（带记忆）

```
用户请求
  → 查询该用户最近 N 条 sentence_memory（如 50～100 条）
  → 构造 prompt：把「已见句子列表」「当前 level」传给 AI
  → AI 生成新句（避免与列表重复、匹配当前 level）
  → 写入 sentence_memory
  → 返回
```

### 3.3 Prompt 示例

```text
你是日语助教。你只输出一句自然的日语句子，不要解释，不要加引号。

约束：
1. 难度：适合 N5 初学者（基础句型、常用助词、简单动词）。
2. 避免与以下已学过的句子重复或过于相似：
   - 昨日は日本語を勉強していた。
   - 今日は天気がいいです。
   - …

请生成一句新的、不重复的短句。
```

### 3.4 去重策略

- **存储前**：对 `sentence` 做归一化（去标点、统一空白），算 `sentence_hash`，若 `(user_id, sentence_hash)` 已存在则不再插入。
- **生成后**：若 AI 返回的句子与已有 hash 相同，可重试一次或直接拒绝并换一句。

---

## 4) API 设计（v0.1）

### 4.1 需要认证的卡片生成

当前 `/api/card` 为 demo，无认证。建议：

- 新增 `GET /api/cards/next-sentence`（需登录）：
  - 从 `sentence_memory` 拉取该用户最近 N 句。
  - 调用 AI 生成新句。
  - 写入 `sentence_memory`。
  - 返回 `{ sentence, sentenceHtml, ... }`。

- 或改造现有 `/api/card`：
  - 若请求带 session，则走记忆流程；否则保持原 demo 行为（无记忆）。

### 4.2 可选：用户等级查询

```http
GET /api/users/me/level
```

返回当前用户的 `level`（如 N5）。初期可写死 N5，后续再根据学习数据调节。

---

## 5) 实施顺序建议

| 阶段 | 内容 | 复杂度 |
|------|------|--------|
| **1** | 创建 `sentence_memory` 表 + migration | 低 |
| **2** | 实现「读最近 N 句 → 构造 prompt → 生成 → 写入」 | 中 |
| **3** | 将 `/api/card` 或新接口接入记忆流程（需登录） | 低 |
| **4** | 增加 `level` 字段并在 prompt 中使用 | 低 |
| **5** | 基于复习数据自动调整 level（可选） | 高 |

建议先做 1～4，满足「避免重复 + 有等级感」；第 5 步可在有更多学习数据后再做。

---

## 6) 与现有 Build Spec 的关系

- Build Spec 中的 `user_memory_state`、`study_events` 主要用于**间隔重复（SRS）**。
- 本设计的 `sentence_memory` 专注于**句子去重与生成约束**。
- 两者可并存：SRS 管「何时复习某张卡」，`sentence_memory` 管「生成时避免什么句子」。

若将来卡片既有预设词库又有 AI 生成句，则：
- 预设卡片：走 SRS，不需要 `sentence_memory`。
- AI 生成的句子卡片：走 `sentence_memory` + SRS。

---

## 7) 小结

- **日语等级**：JLPT N5～N1 有明确语法分层，可先用简化的 `level` 控制生成难度。
- **存储**：单表 `sentence_memory`，字段少，易扩展。
- **生成逻辑**：读取历史 → 拼 prompt → 生成 → 去重写入。
- **复杂度**：v0.1 不引入 `grammar_seen` 等额外表，保持简单。

后续可根据实际使用情况，再考虑语义相似度、按语法点调度等进阶能力。
