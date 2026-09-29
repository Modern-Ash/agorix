---
schema: "agora-ai-sdlc/inception-handoff/v1"
intent: "issue-93"
issue: "https://github.com/Modern-Ash/agorix/issues/93"
runtime: "codex"
swarm: "issue-93-delivery"
work: "issue-93"
branch: "feat/issue-93-ollama-adapter"
pathway: "code"
project-root: "/home/faguero/dev-agora/.agorix-main-issue93"
status: "prepared"
---

# Inception handoff - issue-93

## Objective

Implement Ollama local-model adapter for LearningCompanion.

## Intent Interpretation

Issue #93 introduces the first local/open model path for Agorix. The adapter must use the provider-neutral runtime from #92 and Learning Companion contracts from #85. Ollama is an adapter implementation detail, not a domain dependency.

## Material Clarifications

- Model and endpoint are explicit configuration.
- Capability support is declared by adapter/model configuration.
- Unsupported capabilities fail explicitly or use a documented fallback.
- CI keeps the deterministic fake provider as default.
- Real Ollama integration evidence is optional and gated.

## Level 1 Plan

See `LEVEL1_PLAN.md`.

## User Stories

See `USER_STORIES.md`.

## Non-Functional Requirements

See `NFR.md`.

## Measurement Criteria

See `MEASUREMENT_CRITERIA.md`.

## Proposed Units

One bounded construction unit: provider-runtime Ollama adapter, tests and setup documentation.

## Suggested Bolts

See `BOLTS.md`.

## Acceptance Criteria Trace

The acceptance criteria from issue #93 map directly to configuration, capability negotiation, outage handling, malformed-output validation, credential-free local path, gated integration tests and setup documentation.

## Risk Register

See `RISK_REGISTER.md`.

## Risks, Constraints And Dependencies

Depends on completed #92 and #85. Must not require Ollama in CI, must not leak provider details into domain packages, and must fail closed on malformed model output.

## Source Facts And Proposed Decisions

Source facts are the issue #93 body and provider-runtime architecture from #92. Proposed decision: implement in `@agorix/provider-runtime` with injected fetch for deterministic tests and optional local integration evidence.

## Files Created Or Modified

Inception creates handoffs under `.agora/ai-sdlc/handoffs/issue-93/` and updates Agora work records only.

## Human Decision Required

Product Owner must approve inception before construction can begin.
