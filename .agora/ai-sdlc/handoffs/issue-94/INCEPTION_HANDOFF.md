---
schema: "agora-ai-sdlc/inception-handoff/v1"
intent: "issue-94"
issue: "https://github.com/Modern-Ash/agorix/issues/94"
runtime: "codex"
swarm: "issue-94-delivery"
work: "issue-94"
branch: "feat/issue-94-openai-compatible-gateway"
pathway: "code"
project-root: "/home/faguero/dev-agora/.agorix-main-issue94"
status: "prepared"
---

# Inception handoff - issue-94

## Objective

Implement OpenAI-compatible gateway adapter for local/open inference servers.

## Intent Interpretation

Issue #94 adds a protocol adapter for OpenAI-compatible HTTP gateways. It is not an OpenAI product dependency. The adapter must preserve provider-neutral Learning Companion contracts and explicit capability negotiation.

## Material Clarifications

- Base URL and model id are explicit configuration.
- Auth is optional for local deployments.
- Compatible servers may differ in endpoint and structured-output support.
- Tests must use local mocks/fixtures, not external services.

## Level 1 Plan

See `LEVEL1_PLAN.md`.

## User Stories

See `USER_STORIES.md`.

## Non-Functional Requirements

See `NFR.md`.

## Measurement Criteria

See `MEASUREMENT_CRITERIA.md`.

## Proposed Units

One bounded construction unit: provider-runtime gateway adapter, tests and setup documentation.

## Suggested Bolts

See `BOLTS.md`.

## Acceptance Criteria Trace

The issue acceptance criteria map to base URL/model configuration, optional auth, capability negotiation, malformed-response validation, no browser secret exposure, shared Learning Companion contract and mock-only tests.

## Risk Register

See `RISK_REGISTER.md`.

## Risks, Constraints And Dependencies

Depends on #92 and follows patterns from #93. Must not add OpenAI SDK dependency or external-service tests.

## Source Facts And Proposed Decisions

Source facts are the issue #94 body and provider-runtime architecture. Proposed decision: implement with injected fetch and deterministic fixtures.

## Files Created Or Modified

Inception creates handoffs under `.agora/ai-sdlc/handoffs/issue-94/` and updates Agora work records only.

## Human Decision Required

Product Owner must approve inception before construction can begin.
