## Intent interpretation

Deliver the first complete Agorix experience that proves AI is integrated into the learning method without replacing the learner.

## Material clarifications

- No material clarification detected from the explicit issue.

## Level 1 Plan

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

## User Stories

- US-001 candidate: full browser journey passes deterministically
- US-002 candidate: at least one learner decision is required before AI proposal application
- US-003 candidate: debugger cites/uses actual runtime facts
- US-004 candidate: Step/highlighting works in the flow
- US-005 candidate: reflection captures reasoning without gating completion
- US-006 candidate: test fails if AI can bypass acceptance
- US-007 candidate: artifacts/screenshots demonstrate the product differentiator.
- US-008 candidate: full journey passes in tablet landscape
- US-009 candidate: critical journey passes in tablet portrait
- US-010 candidate: no permanent Scratch-style toolbox is required
- US-011 candidate: World + Code remain the dominant surfaces
- US-012 candidate: interaction survives orientation/viewport change.

## Non-functional requirements

- Explicit constraint/NFR candidate: no external LLM required in CI
- Explicit constraint/NFR candidate: no hidden mutation
- Explicit constraint/NFR candidate: code visible throughout
- Explicit constraint/NFR candidate: mission completion independent from model judgment
- Explicit constraint/NFR candidate: provider unavailable path remains safe
- Explicit constraint/NFR candidate: child-facing copy follows content guide.
- Explicit constraint/NFR candidate: no permanent Scratch-style toolbox is required

## Measurement Criteria

- MC-001: prove AC-001 with observable verification evidence for: full browser journey passes deterministically
- MC-002: prove AC-002 with observable verification evidence for: at least one learner decision is required before AI proposal application
- MC-003: prove AC-003 with observable verification evidence for: debugger cites/uses actual runtime facts
- MC-004: prove AC-004 with observable verification evidence for: Step/highlighting works in the flow
- MC-005: prove AC-005 with observable verification evidence for: reflection captures reasoning without gating completion
- MC-006: prove AC-006 with observable verification evidence for: test fails if AI can bypass acceptance
- MC-007: prove AC-007 with observable verification evidence for: artifacts/screenshots demonstrate the product differentiator.
- MC-008: prove AC-008 with observable verification evidence for: full journey passes in tablet landscape
- MC-009: prove AC-009 with observable verification evidence for: critical journey passes in tablet portrait
- MC-010: prove AC-010 with observable verification evidence for: no permanent Scratch-style toolbox is required
- MC-011: prove AC-011 with observable verification evidence for: World + Code remain the dominant surfaces
- MC-012: prove AC-012 with observable verification evidence for: interaction survives orientation/viewport change.

## Proposed Units

- UOW candidate: create-end-to-end-ai-native-learner-loop-for-first-mission — one cohesive delivery unit for the governed issue.

## Suggested Bolts

- prepare-contract: sequential — confirm scope, repository facts and deterministic acceptance trace.
- verify-01: sequential — implement and verify AC-001; depends on prior accepted scope.
- verify-02: sequential — implement and verify AC-002; depends on prior accepted scope.
- verify-03: sequential — implement and verify AC-003; depends on prior accepted scope.
- verify-04: sequential — implement and verify AC-004; depends on prior accepted scope.
- verify-05: sequential — implement and verify AC-005; depends on prior accepted scope.
- verify-06: sequential — implement and verify AC-006; depends on prior accepted scope.
- verify-07: sequential — implement and verify AC-007; depends on prior accepted scope.
- verify-08: sequential — implement and verify AC-008; depends on prior accepted scope.
- verify-09: sequential — implement and verify AC-009; depends on prior accepted scope.
- verify-10: sequential — implement and verify AC-010; depends on prior accepted scope.
- verify-11: sequential — implement and verify AC-011; depends on prior accepted scope.
- verify-12: sequential — implement and verify AC-012; depends on prior accepted scope.
- final-verification: sequential — run repository checks and collect evidence.

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

## Risk Register

- no external LLM required in CI
- no hidden mutation
- code visible throughout
- mission completion independent from model judgment
- provider unavailable path remains safe
- child-facing copy follows content guide.
- no permanent Scratch-style toolbox is required
- No explicit dependency was declared.

## Risks, constraints and dependencies

- no external LLM required in CI
- no hidden mutation
- code visible throughout
- mission completion independent from model judgment
- provider unavailable path remains safe
- child-facing copy follows content guide.
- no permanent Scratch-style toolbox is required
- No explicit dependency was declared.

## Source facts and proposed decisions

- Source issue objective: Deliver the first complete Agorix experience that proves AI is integrated into the learning method without replacing the learner.
- Pathway: brownfield
- Work: issue-91
- Repository languages: TypeScript, JavaScript
- Build systems: Node, pnpm
- Test files observed: 16
- Files scanned deterministically: 106
- Candidate verification commands: pnpm test
- Proposed decision: keep this deterministic draft non-authoritative until human review.

## Files created or modified

- .agora/ai-sdlc/handoffs/issue-91/DETERMINISTIC_INCEPTION.md (deterministic Inception draft only).

## Human decision required

- Approve, modify or reject this deterministic Inception proposal before Construction.
