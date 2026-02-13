# Product Requirements Document (PRD v0.2)

## 1) Product Goal

Deliver a launch-ready, mobile-first Japanese learning app that helps Chinese-speaking users improve speaking confidence and vocabulary retention through daily AI-assisted study.

## 2) Product Direction (Locked)

- Positioning: AI coach + flashcards
- Primary user: Chinese-speaking learners improving spoken Japanese and vocabulary
- Core promise: learn more naturally with AI support and a scientific memory method

## 3) Scope

### In Scope (MVP)

- Authenticated login and user identity (already implemented)
- User account and basic profile
- Mobile-first study experience (H5 first, app-ready architecture)
- Daily study queue (default 10 new cards + review cards)
- Flashcard learning flow (word cards + sentence cards)
- Sentence cards with highlighted key vocabulary and key grammar points
- Spaced repetition scheduling
- AI explanation for current card (short, contextual, beginner-friendly)
- Client-side AI Provider configuration (user can bring own Provider/API key)
- Session summary (time, accuracy, completed cards, AI usage)
- Daily learning history tracking and day-level history view
- Progress dashboard (streak, cards learned, review performance)
- Payment capability for one-time purchase model

### Out of Scope (MVP)

- Custom user-created cards
- JLPT level selection at onboarding
- Real-time speaking scoring
- Community/social features
- Full grammar course system

## 4) User Personas

### Persona P1: Practical learner
- Chinese-speaking learner focused on practical Japanese usage
- Wants short daily sessions and immediate clarity

### Persona P2: Busy learner
- Has limited time and needs a fast, low-friction learning path
- Values mobile convenience and clear progress

## 5) User Stories

- As a learner, I want a clear daily task so I can start in under one minute.
- As a learner, I want AI to explain difficult words quickly so I do not break focus.
- As a learner, I want review timing to be automatic so I remember words longer.
- As a learner, I want mobile-first flow so I can study in small time slots.
- As a buyer, I want clear one-time purchase value so I can decide quickly.

## 6) Functional Requirements

### FR-1 Daily Plan
- System generates a daily plan with:
  - 10 new cards by default
  - due review cards based on spaced repetition
- User can complete the plan in multiple short sessions.

### FR-2 Flashcard Study (Word + Sentence)
- Each card includes:
  - card type (`word` or `sentence`)
  - Japanese content
  - reading/kana (when applicable)
  - Chinese meaning
  - optional usage note
- Sentence card requirements:
  - highlight key vocabulary in the sentence
  - highlight key grammar pattern in the sentence
  - provide short annotation for highlighted points
- User provides recall feedback to update schedule.

### FR-3 Spaced Repetition
- Card intervals adapt to recall quality.
- Failed cards return sooner and are prioritized.

### FR-4 AI Explanation
- One-tap entry from current card.
- Response format should be concise and readable on mobile.
- Explanation types include:
  - meaning nuance
  - usage context
  - memory cue

### FR-4.1 Client-side Provider Configuration
- User can select AI Provider in client settings.
- User can provide and update own API key/endpoint/model configuration.
- V1 supports OpenAI-compatible format only.
- Configuration validation should run before study usage.
- Provider failures should show actionable fallback and retry guidance.
- Provider key must be encrypted in local storage and only decryptable by the app runtime.
- Sensitive values should not be persisted in plaintext logs.

### FR-5 Progress and Motivation
- Show:
  - streak
  - weekly completion
  - retention trend
  - AI assist usage count

### FR-5.1 Daily Learning History
- System records each user's learning events grouped by calendar day.
- User can view daily history with:
  - cards completed count
  - study duration
  - accuracy summary
  - word cards vs sentence cards count
- History supports basic day-by-day browsing.

### FR-6 Monetization
- Support one-time payment flow in MVP.
- Payment gating for AI usage is deferred; ship learning and provider features first.

## 7) Non-Functional Requirements

- Mobile-first responsive UX
- Stable API behavior for core learning flow
- Authenticated access and secure payment state handling
- Session recovery after interruption
- Clear error states for network and AI failures
- Provider configuration UX should be simple enough for non-technical users

## 8) MVP Metrics (v0.2)

- Activation: first study session completed within 24h
- Engagement: average weekly sessions per active user
- Learning: 14-day review accuracy trend
- AI Value: percentage of sessions using AI explanation
- AI Configuration Success: percentage of users who configure provider and successfully call AI
- Revenue: purchase conversion rate from activated users

## 9) Risks and Mitigations

- Risk: AI quality inconsistency -> Mitigation: strict response style constraints and quality checks
- Risk: users may not perceive one-time purchase value -> Mitigation: clear value messaging and trial exposure
- Risk: mobile UX friction -> Mitigation: prioritize fast start and low tap count
- Risk: provider setup is too technical -> Mitigation: guided setup templates and clear inline validation

## 10) Open Decisions (Round 2)

- Should one-time purchase mean lifetime access or long-duration license?
- Should AI explanation have a daily usage cap before purchase?
- Which payment provider should be used first?