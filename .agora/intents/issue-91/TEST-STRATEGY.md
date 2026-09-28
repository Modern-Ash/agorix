<!-- agora-ai-sdlc:construction/v1 -->

# Test Strategy — issue-91 (First Mission vertical slice)

## Unit (Vitest, no browser)

- `packages/runtime/src/run.test.ts` — movement determinism, nested node-id
  addressing, `touchingGoal` evaluated from real state (not a claim), purity
  (identical input -> identical output), step-limit guard, and
  `describeRunResult` fact-citation (no fabricated position when nothing ran).
- `packages/curriculum/src/first-mission.test.ts` — starting program falls
  short of the goal; the exact completing addition reaches it.
- `packages/tutor-contract/src/proposal.test.ts` — proposal only generated
  when the goal was missed, derived only from the real last observation,
  deterministic; `applyProposal` is pure and never invoked implicitly;
  explicit AC-006 test proving a "rejected" decision never reaches
  `applyProposal` and the program stays referentially unchanged.

Result: 82/82 passing repository-wide (`pnpm test` from root), including the
pre-existing 74.

## E2E (Playwright, `apps/web/e2e/first-mission.spec.ts`)

Run across 6 projects (`apps/web/playwright.config.ts`): desktop plus 5
tablet portrait/landscape sizes (768x1024, 820x1180, 1024x768, 1180x820,
1366x1024) — 24/24 passing.

- **Full journey** (AC-001, AC-002, AC-003, AC-004, AC-005, AC-007): run ->
  short of goal -> debugger cites a real observation -> Ask AI -> proposal
  visible but not applied -> Accept -> program visibly updates -> re-run ->
  `mission-complete` -> reflection fillable without hiding completion.
  Screenshots captured at 4 checkpoints per project (AC-007).
- **Rejection** (AC-006): reject leaves code byte-identical; re-running the
  untouched program still falls short — proves the AI cannot bypass explicit
  acceptance to reach completion.
- **Orientation/viewport change** (AC-008, AC-009, AC-012): World and Code
  stay visible and the code text survives a simulated viewport swap without
  reload.

## What this slice does not test

Blockly-based composition, a real LLM provider, multi-mission curriculum, and
persisted reflection are out of scope (see `IMPLEMENTATION-PLAN.md`) and have
no test coverage here by design, not omission.
