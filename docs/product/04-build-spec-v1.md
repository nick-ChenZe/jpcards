# Build Spec v1

This document translates product requirements into implementation-ready specifications.

## 1) Build Goal

Ship a mobile-first H5 learning loop where logged-in users receive memory-based Japanese cards (word + sentence), study with AI assistance, and review daily history by date.

## 2) Core User Flow

1. User logs in.
2. User enters daily study screen and receives personalized card queue.
3. User studies word/sentence cards and submits recall feedback.
4. User optionally requests AI explanation for current card.
5. System updates memory state and daily history.
6. User can open history screen and inspect day-level learning records.

## 3) Page and Module Scope

## P1 Study Home
- Show today's target and progress:
  - new cards target (default 10)
  - due review count
  - completed count
- CTA: Start Study
- CTA: View Today History

## P2 Study Session
- Render one card at a time.
- Support two card types:
  - `word`
  - `sentence`
- Actions:
  - reveal answer
  - submit recall quality (for spaced repetition)
  - open AI explanation panel

## P3 Sentence Highlight View (within session)
- For sentence cards, render highlight overlays for:
  - key vocabulary spans
  - key grammar spans
- Clicking highlighted region shows concise annotation.

## P4 Daily History
- Date list view (default recent first).
- Date detail view includes:
  - total cards completed
  - total study duration
  - accuracy summary
  - word vs sentence count breakdown

## P5 AI Provider Settings
- Provider format: OpenAI-compatible only (V1).
- Fields:
  - `providerName` (optional label)
  - `baseUrl`
  - `apiKey`
  - `model`
- Validate settings before save.
- Store key in encrypted local storage.

## 4) Data Model (Logical)

## D1 `cards`
- `id`
- `type` (`word` | `sentence`)
- `jp_text`
- `reading` (nullable)
- `zh_meaning`
- `usage_note` (nullable)
- `example_sentence` (nullable; mainly for word cards)
- `metadata_json` (nullable)

## D2 `sentence_annotations`
- `id`
- `card_id` (fk -> cards.id)
- `span_type` (`vocab` | `grammar`)
- `start_index`
- `end_index`
- `label`
- `annotation_zh`

## D3 `user_memory_state`
- `id`
- `user_id`
- `card_id`
- `ease_factor`
- `interval_days`
- `due_at`
- `last_reviewed_at`
- `lapse_count`

## D4 `study_events`
- `id`
- `user_id`
- `card_id`
- `card_type`
- `review_score`
- `is_correct`
- `duration_sec`
- `used_ai_explain` (bool)
- `created_at`

## D5 `study_history_daily`
- `id`
- `user_id`
- `study_date` (local date)
- `completed_total`
- `completed_word`
- `completed_sentence`
- `accuracy_rate`
- `duration_total_sec`
- `ai_usage_count`
- unique key: (`user_id`, `study_date`)

## 5) API Contract (V1)

## A1 Get Daily Queue
- `GET /api/cards/daily-queue`
- Response:
  - `newCards[]`
  - `reviewCards[]`
  - `summary` (newTarget, reviewDue, completedToday)

## A2 Submit Review Result
- `POST /api/cards/review`
- Request:
  - `cardId`
  - `cardType`
  - `reviewScore` (0-3)
  - `durationSec`
  - `usedAiExplain`
- Effect:
  - update `user_memory_state`
  - insert `study_events`
  - upsert `study_history_daily`

## A3 Get Daily History List
- `GET /api/history/days?cursor=...`
- Response:
  - array of day summaries from `study_history_daily`

## A4 Get Day Detail
- `GET /api/history/day?date=YYYY-MM-DD`
- Response:
  - summary + event snippets for that day

## A5 Get AI Explanation
- `POST /api/chat/explain`
- Request:
  - `cardId`
  - `promptType` (`meaning` | `usage` | `memory`)
  - `providerConfigRef` (client config reference)
- Notes:
  - provider format is OpenAI-compatible only in V1

## 6) Sentence Highlight Schema

Example response payload for sentence card:

```json
{
  "cardId": "c_123",
  "type": "sentence",
  "jpText": "昨日は日本語を勉強していた。",
  "highlights": [
    {
      "spanType": "vocab",
      "startIndex": 3,
      "endIndex": 6,
      "label": "日本語",
      "annotationZh": "日语（名词）"
    },
    {
      "spanType": "grammar",
      "startIndex": 7,
      "endIndex": 12,
      "label": "〜していた",
      "annotationZh": "过去进行/持续状态"
    }
  ]
}
```

## 7) Security and Storage Constraints

- API key must not be logged in plaintext.
- API key must be stored encrypted locally.
- Decryption capability must be scoped to application runtime only.
- If decryption fails, prompt user to re-enter key safely.

## 8) Acceptance Criteria

## AC-1 Daily Queue
- Logged-in user can fetch queue and start study within 2 taps.

## AC-2 Card Rendering
- Both word and sentence cards render correctly on mobile.
- Sentence cards display vocab + grammar highlights with annotation.

## AC-3 Memory-based Distribution
- Reviewing a card updates next due time and affects future queue.

## AC-4 Daily History
- Every completed review contributes to same-day history aggregation.
- User can browse history by day and open day detail.

## AC-5 AI Settings
- User can save OpenAI-compatible settings and pass validation.
- Encrypted key persists across refresh and can be used for explanation calls.

## 9) Build Order

1. Data model migrations (`cards`, `sentence_annotations`, `user_memory_state`, `study_events`, `study_history_daily`)
2. Daily queue + review submission APIs
3. Study session UI with word/sentence renderer
4. Sentence highlight rendering and annotation interactions
5. Daily history API + UI
6. Provider settings and encrypted key storage
7. AI explanation integration and end-to-end tests
