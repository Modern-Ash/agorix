<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Level 1 Plan — issue-91

- scope: execute — lock the explicit issue objective, constraints and acceptance criteria.
- implement-01: execute — satisfy AC-001: full browser journey passes deterministically
- implement-02: execute — satisfy AC-002: at least one learner decision is required before AI proposal application
- implement-03: execute — satisfy AC-003: debugger cites/uses actual runtime facts
- implement-04: execute — satisfy AC-004: Step/highlighting works in the flow
- implement-05: execute — satisfy AC-005: reflection captures reasoning without gating completion
- implement-06: execute — satisfy AC-006: test fails if AI can bypass acceptance
- implement-07: execute — satisfy AC-007: artifacts/screenshots demonstrate the product differentiator.
- implement-08: execute — satisfy AC-008: full journey passes in tablet landscape
- implement-09: execute — satisfy AC-009: critical journey passes in tablet portrait
- implement-10: execute — satisfy AC-010: no permanent Scratch-style toolbox is required
- implement-11: execute — satisfy AC-011: World + Code remain the dominant surfaces
- implement-12: execute — satisfy AC-012: interaction survives orientation/viewport change.
- verify: execute — run targeted verification and collect evidence before review.

## Acceptance criteria trace

- AC-001: full browser journey passes deterministically -> plan step implement-01 -> bolt verify-01
- AC-002: at least one learner decision is required before AI proposal application -> plan step implement-02 -> bolt verify-02
- AC-003: debugger cites/uses actual runtime facts -> plan step implement-03 -> bolt verify-03
- AC-004: Step/highlighting works in the flow -> plan step implement-04 -> bolt verify-04
- AC-005: reflection captures reasoning without gating completion -> plan step implement-05 -> bolt verify-05
- AC-006: test fails if AI can bypass acceptance -> plan step implement-06 -> bolt verify-06
- AC-007: artifacts/screenshots demonstrate the product differentiator. -> plan step implement-07 -> bolt verify-07
- AC-008: full journey passes in tablet landscape -> plan step implement-08 -> bolt verify-08
- AC-009: critical journey passes in tablet portrait -> plan step implement-09 -> bolt verify-09
- AC-010: no permanent Scratch-style toolbox is required -> plan step implement-10 -> bolt verify-10
- AC-011: World + Code remain the dominant surfaces -> plan step implement-11 -> bolt verify-11
- AC-012: interaction survives orientation/viewport change. -> plan step implement-12 -> bolt verify-12

## Source facts

- Pathway: brownfield
- Repository languages: TypeScript, JavaScript
- Build systems: Node, pnpm
- Candidate verification commands: pnpm test
