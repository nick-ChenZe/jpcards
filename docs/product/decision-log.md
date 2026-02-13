# Decision Log

Use this file to record product decisions in chronological order.

## Template

### [YYYY-MM-DD] Decision Title
- Context:
- Decision:
- Alternatives considered:
- Impact:
- Owner:

---

### [2026-02-12] Initial Documentation Structure
- Context: Product direction was unclear and needed a retrievable requirement archive.
- Decision: Create app-specific docs under `docs/product/japanese-learning-app/`.
- Alternatives considered: Keep ad-hoc notes in root markdown files.
- Impact: Improves traceability and future collaboration.
- Owner: Product Owner + AI Co-Founder

### [2026-02-12] Lock Product Direction for V1
- Context: Round 1 owner input was provided to define product scope and go-to-market baseline.
- Decision:
  - Use Option B (AI coach + flashcards) as core positioning.
  - Target Chinese-speaking users focused on spoken Japanese and vocabulary.
  - Core promise: more natural language learning with scientific memory.
  - Exclude custom cards and JLPT onboarding in MVP.
  - Set default daily new-card target to 10.
  - Aim for launch-ready quality and mobile-first experience (H5 first).
  - Prioritize ease of daily use, AI explanation quality, and user experience polish.
- Alternatives considered: Option A (vocabulary-only), Option C (JLPT-path-first), and broader MVP scope.
- Impact: Enables a differentiated but controlled MVP scope and clear execution priorities.
- Owner: Product Owner

### [2026-02-12] Move to Flat Product Docs + Add BYO Provider Capability
- Context: Owner updated documentation structure and requested AI capability to be client-side configurable by users.
- Decision:
  - Keep product docs directly under `docs/product/` in a flat archive structure.
  - Add client-side BYO Provider as a first-class product feature in MVP scope.
  - Users can configure their own AI Provider credentials/settings from client settings.
- Alternatives considered: Keep app-specific subdirectory and server-only provider strategy.
- Impact: Simplifies document retrieval and increases product flexibility/differentiation for AI usage.
- Owner: Product Owner

### [2026-02-12] Lock Provider Constraints for V1
- Context: Round 2 provider decisions were provided to unblock implementation details.
- Decision:
  - V1 supports OpenAI-compatible provider format only.
  - Provider key must be encrypted in local storage and only decryptable by the app.
  - Do not block provider feature by payment in current phase; prioritize feature completion.
- Alternatives considered: Multi-provider V1 support and payment-first AI gating.
- Impact: Reduces integration complexity while securing credentials and accelerating feature delivery.
- Owner: Product Owner

### [2026-02-12] Align Core Feature List for Build
- Context: Owner requested a final alignment on primary user-facing capabilities before implementation.
- Decision:
  - Keep login as the first completed entry point.
  - Distribute Japanese learning cards per user memory state.
  - Support both word cards and sentence cards in V1.
  - Require sentence-level highlighting for key vocabulary and grammar points.
  - Record and display per-user learning history grouped by day.
- Alternatives considered: Word-only cards and aggregate history without day-level view.
- Impact: Clarifies core loop and acceptance boundaries for execution phase.
- Owner: Product Owner

### [2026-02-12] Freeze v1 Build Spec
- Context: Core feature list was aligned and needed implementation-level contracts.
- Decision: Create `04-build-spec-v1.md` as execution baseline including page scope, data model, API contracts, sentence highlight schema, security constraints, and acceptance criteria.
- Alternatives considered: Start coding from PRD directly without an implementation contract.
- Impact: Reduces ambiguity, improves delivery speed, and enables parallel frontend/backend implementation.
- Owner: Product Owner + AI Co-Founder
