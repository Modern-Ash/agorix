# Provider-backed proposals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. TDD per task.

**Goal:** Implement the spec. **Spec:** `docs/superpowers/specs/2026-10-05-provider-proposals-design.md`

## Global Constraints

- No `vscode` import in `studioProposalSource.ts`. No learner free text in telemetry or logs. Works with AI off.
- Run from `agorix/`: `pnpm test`, `pnpm lint`, `pnpm -r typecheck`.

## Review Focus

- Provider returns a proposal for a stale base hash or an invalid program.
- Budget exhausted mid-session degrades with a notice and never throws.
- Safety-rejected response never reaches the UI.
- Remote endpoint without `allowRemote` is never contacted.
- Async race: program changes while the request is in flight.

## Tasks

1. Request builder extraction + `createCompanionTurn` `providerResponse` option.
2. `studioProposalSource.ts` with tests (fake fetch, real pipeline).
3. Async `proposeFor` in `agentPort`/`agentHost`; provider primary + built-in alternative.
4. Protocol `origin`/`notice` + UI labels.
5. Wiring in `studioRuntime` (pipeline, budget setting, config change), Companion build; docs; full verification.
