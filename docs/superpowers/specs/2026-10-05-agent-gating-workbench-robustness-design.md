# Agent gating, clarification and Workbench robustness (design)

Sub-project 5 of the Studio "powerization" remainder (#248/#249 remainders and Workbench robustness). Date: 2026-10-05.

## Goal

Close the remaining #248/#249 behavior that does not need a provider or side-by-side alternatives, and harden Workbench edits.

## Success criteria

- Each item below has a deterministic test for its success and failure path.
- Intent free text is never stored or logged; everything works with AI off.
- Manual Workbench edits are never blocked by prediction gating.

## Design

1. **Prediction gating.** `AgentAgreements.requirePredictionBeforeAccept: boolean`, default `false`, optional when parsed. With the flag on, the host sends the `prediction` message at stage `proposal`; `decideProposal(accepted)` without a prediction returns `error PREDICTION_REQUIRED` and mutates nothing. New workflow event `prePredictionMade` (valid at `proposal` with a requested proposal); accepting with `predicted` already true goes straight to `run`; rejecting clears it. The agent panel gets a visible toggle and a disabled Accept until predicted.
2. **Clarifying question.** Pure `needsClarification(intent, available)` in `plan.ts`: zero keyword hits and more than one available task means ask; otherwise plan. Protocol: `HostMessage` `clarify { options: AgentTask[] }`, `UiMessage` `answerClarification { taskId }`. At most one question; the answer pins the plan to that task. Options are fixed task titles, never learner text.
3. **Stale base hash on intent.** `stateIntent` records `planBaseHash`; `acceptPlan` and `answerClarification` compare it with the current hash. On mismatch the loop resets and the host emits `error STALE_PLAN`. `onProgramChanged` also resets at stage `plan`.
4. **Stale base hash on Workbench edits.** Mutating intents carry an optional `baseHash` on the `intent` UiMessage; the UI sends the last `programHash` it saw. On mismatch the host answers `error STALE_EDIT` plus a fresh snapshot and does not commit.
5. **Illegal placement reason.** `BlockEditorAdapterError` gets an optional `reason`: `NOT_A_CONTAINER`, `BAD_INDEX`, `BLOCK_NOT_FOUND`, `NOT_A_STATEMENT`, `WOULD_BREAK_PROGRAM`. `error INVALID_CHANGE` carries an optional `reason`; `statusFor` maps it to plain text in the aria-live region.
6. **Extension Host test.** `test/integration/index.cjs` gains a Workbench flow: open project, open Workbench, assert the "Agorix Workbench" tab exists. Webview content is covered by host and UI unit tests. If VS Code cannot launch here it is written and reported as not run.

## Out of scope

Alternatives with trade-offs (sub-project 2), provider-backed plans (sub-project 3).
