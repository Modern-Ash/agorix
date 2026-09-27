## Intent interpretation

Create a browser-level test that proves the core transparency invariant end to end.

## Material clarifications

- No material clarification detected from the explicit issue.

## Level 1 Plan

- scope: execute — lock the explicit issue objective, constraints and acceptance criteria.
- implement-01: execute — satisfy AC-001: test fails if proposal auto-applies
- implement-02: execute — satisfy AC-002: test fails if code is hidden during proposal/execution
- implement-03: execute — satisfy AC-003: test fails if highlight cannot map through canonical node id
- implement-04: execute — satisfy AC-004: test proves reject is side-effect free
- implement-05: execute — satisfy AC-005: test proves accepted proposal executes deterministically
- implement-06: execute — satisfy AC-006: stable in CI.
- implement-07: execute — satisfy AC-007: test fails if code becomes inaccessible on tablet
- implement-08: execute — satisfy AC-008: tablet portrait and landscape are both covered
- implement-09: execute — satisfy AC-009: orientation/viewport change preserves canonical state
- implement-10: execute — satisfy AC-010: no hover/right-click dependency is required.
- verify: execute — run targeted verification and collect evidence before review.

## User Stories

- US-001 candidate: test fails if proposal auto-applies
- US-002 candidate: test fails if code is hidden during proposal/execution
- US-003 candidate: test fails if highlight cannot map through canonical node id
- US-004 candidate: test proves reject is side-effect free
- US-005 candidate: test proves accepted proposal executes deterministically
- US-006 candidate: stable in CI.
- US-007 candidate: test fails if code becomes inaccessible on tablet
- US-008 candidate: tablet portrait and landscape are both covered
- US-009 candidate: orientation/viewport change preserves canonical state
- US-010 candidate: no hover/right-click dependency is required.

## Non-functional requirements

- Explicit constraint/NFR candidate: deterministic fake provider
- Explicit constraint/NFR candidate: no network/real LLM credential
- Explicit constraint/NFR candidate: no arbitrary sleeps
- Explicit constraint/NFR candidate: assert canonical/base hash where practical
- Explicit constraint/NFR candidate: desktop + narrow viewport
- Explicit constraint/NFR candidate: retain trace/screenshots on failure.
- Explicit constraint/NFR candidate: no hover/right-click dependency is required.

## Measurement Criteria

- MC-001: prove AC-001 with observable verification evidence for: test fails if proposal auto-applies
- MC-002: prove AC-002 with observable verification evidence for: test fails if code is hidden during proposal/execution
- MC-003: prove AC-003 with observable verification evidence for: test fails if highlight cannot map through canonical node id
- MC-004: prove AC-004 with observable verification evidence for: test proves reject is side-effect free
- MC-005: prove AC-005 with observable verification evidence for: test proves accepted proposal executes deterministically
- MC-006: prove AC-006 with observable verification evidence for: stable in CI.
- MC-007: prove AC-007 with observable verification evidence for: test fails if code becomes inaccessible on tablet
- MC-008: prove AC-008 with observable verification evidence for: tablet portrait and landscape are both covered
- MC-009: prove AC-009 with observable verification evidence for: orientation/viewport change preserves canonical state
- MC-010: prove AC-010 with observable verification evidence for: no hover/right-click dependency is required.

## Proposed Units

- UOW candidate: create-e2e-transparency-journey-proving-no-hidden-mutation-and-observable-execution — one cohesive delivery unit for the governed issue.

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
- final-verification: sequential — run repository checks and collect evidence.

## Acceptance criteria trace

- AC-001: test fails if proposal auto-applies -> plan step implement-01 -> bolt verify-01
- AC-002: test fails if code is hidden during proposal/execution -> plan step implement-02 -> bolt verify-02
- AC-003: test fails if highlight cannot map through canonical node id -> plan step implement-03 -> bolt verify-03
- AC-004: test proves reject is side-effect free -> plan step implement-04 -> bolt verify-04
- AC-005: test proves accepted proposal executes deterministically -> plan step implement-05 -> bolt verify-05
- AC-006: stable in CI. -> plan step implement-06 -> bolt verify-06
- AC-007: test fails if code becomes inaccessible on tablet -> plan step implement-07 -> bolt verify-07
- AC-008: tablet portrait and landscape are both covered -> plan step implement-08 -> bolt verify-08
- AC-009: orientation/viewport change preserves canonical state -> plan step implement-09 -> bolt verify-09
- AC-010: no hover/right-click dependency is required. -> plan step implement-10 -> bolt verify-10

## Risk Register

- deterministic fake provider
- no network/real LLM credential
- no arbitrary sleeps
- assert canonical/base hash where practical
- desktop + narrow viewport
- retain trace/screenshots on failure.
- no hover/right-click dependency is required.
- No explicit dependency was declared.

## Risks, constraints and dependencies

- deterministic fake provider
- no network/real LLM credential
- no arbitrary sleeps
- assert canonical/base hash where practical
- desktop + narrow viewport
- retain trace/screenshots on failure.
- no hover/right-click dependency is required.
- No explicit dependency was declared.

## Source facts and proposed decisions

- Source issue objective: Create a browser-level test that proves the core transparency invariant end to end.
- Pathway: brownfield
- Work: issue-78
- Repository languages: TypeScript, JavaScript
- Build systems: Node, pnpm
- Test files observed: 19
- Files scanned deterministically: 149
- Candidate verification commands: pnpm test
- Proposed decision: keep this deterministic draft non-authoritative until human review.

## Files created or modified

- .agora/ai-sdlc/handoffs/issue-78/DETERMINISTIC_INCEPTION.md (deterministic Inception draft only).

## Human decision required

- Approve, modify or reject this deterministic Inception proposal before Construction.
