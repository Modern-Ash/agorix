# Domain model - issue #74

## Concepts

- Learner intent: child-authored goal or request before a program change.
- ProgramProposal: provisional AI-originated or scaffolded change that is not accepted state.
- Affected program region: canonical node/block/code span touched by a proposed or direct change.
- Accepted program: canonical `ProjectProgram` after explicit learner decision.
- Runtime evidence: deterministic observations, trace entries, state before/after and completion facts.
- Surface affordance: Web/Tablet card/sheet or Studio diff/inspector presentation of the same semantics.

## Invariants

- ProgramProposal is never canonical state.
- Canonical mutation requires explicit learner accept/modify/direct edit action.
- Runtime, not AI prose, proves behavior.
- Code remains visible during editing, proposal review, execution, debugging and reflection.
- Surface presentation may differ, but proposal and execution semantics are identical.
