# Ori Agent Runtime v2 — evidence-gated proposals

This vertical increment composes the existing v1 observe/plan/inspect/verify loop with a bounded structured proposal. The host supplies capabilities and grants, and the agent may read only `inspectProgram` and `inspectTrace`. It never executes shell, filesystem, network or writes.

The first proposal scope is deliberately narrow: after at least one learner attempt and hint, Ori may suggest one `move(1)` or `turn(right)` block if the verified host snapshot authorizes it. The proposal is validated against `ori/proposal/v0`, and the host alone decides accept/edit/reject. No automatic application.

Run `npm test` and `npm run check` before merging. Tests use synthetic host ports, not the actual Agorix runtime. The next milestone must implement simulateProgram and trace cross-check (#17), then host-side preview/review with Agorix on `integration/ori` only. Do not claim full Codex/Claude Code parity or child-facing readiness.
