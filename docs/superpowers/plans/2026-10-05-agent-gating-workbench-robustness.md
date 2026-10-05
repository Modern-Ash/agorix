# Agent gating, clarification and Workbench robustness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. TDD per task.

**Goal:** Implement the six items of the spec.
**Spec:** `docs/superpowers/specs/2026-10-05-agent-gating-workbench-robustness-design.md`

## Global Constraints

- Domain packages never import `vscode`; no learner text stored or logged; works with AI off.
- Run from `agorix/`: `pnpm test`, `pnpm lint`, `pnpm -r typecheck`.

## Review Focus

- Accept blocked only when the flag is on and only for AI proposals; manual edits unaffected.
- Program changes between intent and accept-plan.
- Stale `baseHash` edit must not commit and must resend a snapshot.
- Reject with a pending pre-prediction clears it.

## Tasks (each: failing test, implement, run, commit)

1. **Placement reasons** — `block-editor` (`adapter.ts`, `changes.ts`), protocol `error.reason`, `statusFor` text.
2. **Workbench stale edit** — protocol `baseHash` on `intent`, `STALE_EDIT` error, `workbenchHost`, `Workbench.tsx` sends hash.
3. **Clarification + stale plan** — `plan.ts`, protocol `clarify`/`answerClarification`/`STALE_PLAN`, `agentHost`, `AgentPanel`/`agentUi`.
4. **Prediction gating** — `assistance.ts` flag, `loop.ts` event, protocol agreements parse + `PREDICTION_REQUIRED`, `agentHost`, panel toggle.
5. **Extension Host test + docs** — `test/integration/index.cjs`, `AGORIX_STUDIO.md`, full verification.
