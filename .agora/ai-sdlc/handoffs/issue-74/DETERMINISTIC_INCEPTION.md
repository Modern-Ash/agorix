## Intent interpretation

Translate “Nothing happens under the rug” into testable UX and architecture rules before implementation.

## Material clarifications

- No material clarification detected from the explicit issue.

## Level 1 Plan

- scope: execute — lock the explicit issue objective, constraints and acceptance criteria.
- implement-01: execute — satisfy AC-001: every program mutation path is documented
- implement-02: execute — satisfy AC-002: there is no allowed silent AI mutation path
- implement-03: execute — satisfy AC-003: Step behavior is specified
- implement-04: execute — satisfy AC-004: code visibility requirements are explicit at normal/narrow viewports
- implement-05: execute — satisfy AC-005: UX differentiates proposal vs accepted code vs executing instruction
- implement-06: execute — satisfy AC-006: design can be tested with Playwright
- implement-07: execute — satisfy AC-007: ADR states why runtime, not AI, is execution authority.
- implement-08: execute — satisfy AC-008: UX contract covers tablet landscape and portrait
- implement-09: execute — satisfy AC-009: UX contract covers Studio
- implement-10: execute — satisfy AC-010: code visibility rules are explicit per surface
- implement-11: execute — satisfy AC-011: proposal semantics are identical across surfaces
- implement-12: execute — satisfy AC-012: touch interaction references #120
- implement-13: execute — satisfy AC-013: design language references #117.
- verify: execute — run targeted verification and collect evidence before review.

## User Stories

- US-001 candidate: every program mutation path is documented
- US-002 candidate: there is no allowed silent AI mutation path
- US-003 candidate: Step behavior is specified
- US-004 candidate: code visibility requirements are explicit at normal/narrow viewports
- US-005 candidate: UX differentiates proposal vs accepted code vs executing instruction
- US-006 candidate: design can be tested with Playwright
- US-007 candidate: ADR states why runtime, not AI, is execution authority.
- US-008 candidate: UX contract covers tablet landscape and portrait
- US-009 candidate: UX contract covers Studio
- US-010 candidate: code visibility rules are explicit per surface
- US-011 candidate: proposal semantics are identical across surfaces
- US-012 candidate: touch interaction references #120
- US-013 candidate: design language references #117.

## Non-functional requirements

- Explicit constraint/NFR candidate: do not overload beginners with developer diagnostics
- Explicit constraint/NFR candidate: distinguish “AI suggestion” from “your accepted program”
- Explicit constraint/NFR candidate: avoid anthropomorphic certainty
- Explicit constraint/NFR candidate: make causal relation instruction → state → visible result inspectable
- Explicit constraint/NFR candidate: accessibility requirements still apply.
- Explicit constraint/NFR candidate: there is no allowed silent AI mutation path

## Measurement Criteria

- MC-001: prove AC-001 with observable verification evidence for: every program mutation path is documented
- MC-002: prove AC-002 with observable verification evidence for: there is no allowed silent AI mutation path
- MC-003: prove AC-003 with observable verification evidence for: Step behavior is specified
- MC-004: prove AC-004 with observable verification evidence for: code visibility requirements are explicit at normal/narrow viewports
- MC-005: prove AC-005 with observable verification evidence for: UX differentiates proposal vs accepted code vs executing instruction
- MC-006: prove AC-006 with observable verification evidence for: design can be tested with Playwright
- MC-007: prove AC-007 with observable verification evidence for: ADR states why runtime, not AI, is execution authority.
- MC-008: prove AC-008 with observable verification evidence for: UX contract covers tablet landscape and portrait
- MC-009: prove AC-009 with observable verification evidence for: UX contract covers Studio
- MC-010: prove AC-010 with observable verification evidence for: code visibility rules are explicit per surface
- MC-011: prove AC-011 with observable verification evidence for: proposal semantics are identical across surfaces
- MC-012: prove AC-012 with observable verification evidence for: touch interaction references #120
- MC-013: prove AC-013 with observable verification evidence for: design language references #117.

## Proposed Units

- UOW candidate: define-transparent-construction-ux-contract-and-nothing-under-the-rug-adr — one cohesive delivery unit for the governed issue.

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
- verify-13: sequential — implement and verify AC-013; depends on prior accepted scope.
- final-verification: sequential — run repository checks and collect evidence.

## Acceptance criteria trace

- AC-001: every program mutation path is documented -> plan step implement-01 -> bolt verify-01
- AC-002: there is no allowed silent AI mutation path -> plan step implement-02 -> bolt verify-02
- AC-003: Step behavior is specified -> plan step implement-03 -> bolt verify-03
- AC-004: code visibility requirements are explicit at normal/narrow viewports -> plan step implement-04 -> bolt verify-04
- AC-005: UX differentiates proposal vs accepted code vs executing instruction -> plan step implement-05 -> bolt verify-05
- AC-006: design can be tested with Playwright -> plan step implement-06 -> bolt verify-06
- AC-007: ADR states why runtime, not AI, is execution authority. -> plan step implement-07 -> bolt verify-07
- AC-008: UX contract covers tablet landscape and portrait -> plan step implement-08 -> bolt verify-08
- AC-009: UX contract covers Studio -> plan step implement-09 -> bolt verify-09
- AC-010: code visibility rules are explicit per surface -> plan step implement-10 -> bolt verify-10
- AC-011: proposal semantics are identical across surfaces -> plan step implement-11 -> bolt verify-11
- AC-012: touch interaction references #120 -> plan step implement-12 -> bolt verify-12
- AC-013: design language references #117. -> plan step implement-13 -> bolt verify-13

## Risk Register

- do not overload beginners with developer diagnostics
- distinguish “AI suggestion” from “your accepted program”
- avoid anthropomorphic certainty
- make causal relation instruction → state → visible result inspectable
- accessibility requirements still apply.
- there is no allowed silent AI mutation path
- No explicit dependency was declared.

## Risks, constraints and dependencies

- do not overload beginners with developer diagnostics
- distinguish “AI suggestion” from “your accepted program”
- avoid anthropomorphic certainty
- make causal relation instruction → state → visible result inspectable
- accessibility requirements still apply.
- there is no allowed silent AI mutation path
- No explicit dependency was declared.

## Source facts and proposed decisions

- Source issue objective: Translate “Nothing happens under the rug” into testable UX and architecture rules before implementation.
- Pathway: documentation
- Work: issue-74
- Repository languages: TypeScript, JavaScript
- Build systems: Node, pnpm
- Test files observed: 18
- Files scanned deterministically: 141
- Candidate verification commands: pnpm test
- Proposed decision: keep this deterministic draft non-authoritative until human review.

## Files created or modified

- .agora/ai-sdlc/handoffs/issue-74/DETERMINISTIC_INCEPTION.md (deterministic Inception draft only).

## Human decision required

- Approve, modify or reject this deterministic Inception proposal before Construction.
