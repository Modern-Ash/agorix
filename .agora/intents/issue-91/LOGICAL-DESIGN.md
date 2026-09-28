<!-- agora-ai-sdlc:construction/v1 -->

# Logical Design — issue-91 (First Mission vertical slice)

## Dependency direction (unchanged from docs/architecture/SYSTEM_DESIGN.md)

```
apps/web
  -> @agorix/curriculum -> @agorix/program-model, @agorix/runtime
  -> @agorix/code-generator -> @agorix/program-model
  -> @agorix/tutor-contract -> @agorix/program-model, @agorix/runtime
  -> @agorix/runtime -> @agorix/program-model
```

No domain package imports UI framework code (AGENTS.md invariant preserved).

## Loop (state machine in `App.tsx`)

1. `idle` — starting program loaded from `@agorix/curriculum`, code visible.
2. Learner clicks **Run** -> `runProgram()` executes deterministically;
   observations animate sprite + code highlight; phase becomes `ran`.
3. If `reachedGoal` is false: a debugger message (`describeRunResult`) cites
   the last real observation. Learner may click **Ask AI for a hint**.
4. `proposeCompletion()` reads only the last `RunResult` and proposes one
   bounded `append-statements` change with a rationale — never applied yet.
5. Learner must click **Accept** or **Reject** — no other path changes
   `program` state (AC-002, AC-006). Reject leaves the program byte-identical.
6. Accept calls `applyProposal()`, resets run state; learner must click
   **Run** again — completion is always runtime-determined on this next run,
   never inferred from the proposal being accepted.
7. Reflection textarea is always rendered and never disables/hides
   `mission-complete` (AC-005).

## Why an explicit two-click re-run instead of auto-running after Accept

Auto-running after Accept would make "AI proposes -> program changes ->
mission completes" look like one AI-driven action. Requiring a second,
separate **Run** keeps "runtime proves" strictly downstream of a learner
action, not the proposal's acceptance.
