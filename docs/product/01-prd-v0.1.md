# Product Requirements Document (PRD v0.1 Draft)

## 1) Product Goal

Help users build a daily Japanese vocabulary learning habit and improve long-term retention through structured study and review.

## 2) Scope

### In Scope (MVP)

- User account and basic profile
- Daily study queue (new cards + review cards)
- Flashcard learning flow (meaning, reading, example sentence)
- Spaced repetition scheduling
- Session summary (time, accuracy, completed cards)
- Lightweight AI explanation for unknown words
- Progress dashboard (streak, cards learned, review performance)

### Out of Scope (MVP)

- Full grammar lessons and exercises
- Speech scoring
- Multiplayer/community
- Full offline mode

## 3) User Personas

### Persona P1: Beginner self-learner
- Wants clear instructions every day
- Gets lost when content is too broad

### Persona P2: Returning learner
- Already knows some words
- Needs review structure and progress feedback

## 4) User Stories

- As a learner, I want to know exactly what to study today so I can start quickly.
- As a learner, I want old words to reappear at the right time so I do not forget them.
- As a learner, I want concise explanations when I get stuck so I can continue without leaving the app.
- As a learner, I want to see my progress so I stay motivated.

## 5) Functional Requirements

### FR-1 Daily Plan
- System generates a daily target with configurable limits.
- Daily plan includes both new and review cards.

### FR-2 Card Study
- Card shows Japanese term, kana/reading, meaning, and one example.
- User self-rates recall quality after each card.

### FR-3 Spaced Repetition Engine
- Review interval updates based on recall quality.
- Missed cards are prioritized in near-term review.

### FR-4 AI Assist (Lightweight)
- User can ask "why/usage/mnemonic" for current card.
- Response should be short, beginner-friendly, and contextual.

### FR-5 Progress Tracking
- Show daily streak, completion rate, and retention trend.
- Display weekly summary.

## 6) Non-Functional Requirements

- Responsive UI for mobile and desktop browsers
- Typical API response under acceptable interactive threshold
- Basic account security and authenticated access
- Stable behavior for interrupted sessions

## 7) MVP Metrics (Draft)

- Activation: user finishes first study session within 24h of signup
- Engagement: weekly sessions per active user
- Learning: review accuracy and repeat error reduction
- Retention: D7 and D30 retention

## 8) Risks and Mitigations

- Risk: too much content effort early -> Mitigation: start with limited card packs
- Risk: users churn without motivation -> Mitigation: streaks + session completion feedback
- Risk: AI answers too long/confusing -> Mitigation: strict prompt style and response limits

## 9) Open Decisions

- Should V1 require JLPT-level selection at onboarding?
- Should users add custom cards in MVP?
- What is the default daily new-card limit?
- Which metric determines "learning success" for first 30 days?
