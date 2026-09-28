<!-- agora-ai-sdlc:construction/v1 -->

# Domain Model — issue-91 (First Mission vertical slice)

## New packages (real implementation, not placeholders)

- `@agorix/runtime` (`packages/runtime/src/run.ts`) — deterministic step-by-step
  interpreter over `agorix/program/v1`. Produces `StepObservation[]` addressed by
  the same path-derived node ids as `@agorix/code-generator`, so runtime steps
  and code ranges share one identity. `describeRunResult` is the sole source of
  debugger/tutor-facing facts (AC-003).
- `@agorix/curriculum` (`packages/curriculum/src/first-mission.ts`) — First
  Mission's fixed `WorldConfig` and deliberately-incomplete starting program.
- `@agorix/tutor-contract` (`packages/tutor-contract/src/proposal.ts`) —
  provider-neutral, deterministic (fake, no external LLM) proposal contract:
  `proposeCompletion` reads only real `RunResult` facts; `applyProposal` is a
  pure function the UI must gate behind an explicit "Accept" click (AC-002,
  AC-006).

## Reused as-is

- `@agorix/program-model` — canonical AST, unchanged.
- `@agorix/code-generator` `projectProgram()` — code text + `NodeTextMapping`,
  unchanged; runtime node ids were deliberately designed to match its scheme.

## apps/web (new)

- `World.tsx` — SVG render of sprite/goal from `runtime` state.
- `CodePanel.tsx` — always-visible code, highlights the node id of the
  currently-executing step.
- `App.tsx` — orchestrates run → observe → (optional) AI proposal → explicit
  accept/reject → re-run → runtime-determined completion → non-blocking
  reflection.

## Product decision recorded during Construction

`docs/product/LEARNER_JOURNEY.md` D4 ("toolbox left rail") is superseded by
issue #91 AC-010/AC-011 (no permanent toolbox; World+Code dominant), per
explicit human decision during this Construction session (2026-09-28). See
`docs/product/LEARNER_JOURNEY.md` for the updated note.
