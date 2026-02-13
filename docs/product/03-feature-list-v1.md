# V1 Core Feature List (Aligned)

This document locks the main feature list for V1 execution.

## F1 Authentication

- User can log in and access personal learning data.
- Status: implemented (owner confirmed).

## F2 Personalized Daily Card Distribution

- System distributes daily cards based on each user's memory state and review schedule.
- Daily queue contains:
  - new cards (default 10)
  - review cards (due by spaced repetition)

## F3 Card Types

- V1 supports:
  - word cards
  - sentence cards

## F4 Sentence Highlighting

- Sentence cards must highlight:
  - key vocabulary
  - key grammar points
- Highlighted points must include concise annotation for learning context.

## F5 Daily Learning History

- Learning history is recorded per user and grouped by day.
- Day-level history view includes:
  - completed cards
  - study duration
  - accuracy summary
  - word/sentence completion breakdown

## F6 AI Explanation

- User can request AI explanation while studying a card.
- V1 provider capability:
  - OpenAI-compatible format only
  - user-configured provider settings on client side
  - key encrypted in local storage

## F7 V1 Non-Goals

- No custom user-created cards
- No JLPT onboarding selection
- No speaking scoring
- No social features
