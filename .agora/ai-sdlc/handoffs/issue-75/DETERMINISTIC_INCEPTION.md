## Intent interpretation

Ensure AI-originated program changes can never mutate canonical state invisibly.

## Material clarifications

- No material clarification detected from the explicit issue.

## Level 1 Plan

- scope: execute — lock the explicit issue objective, constraints and acceptance criteria.
- implement-01: execute — satisfy AC-001: proposal cannot mutate program before explicit acceptance
- implement-02: execute — satisfy AC-002: reject preserves exact canonical hash/state
- implement-03: execute — satisfy AC-003: accepted proposal passes canonical validator
- implement-04: execute — satisfy AC-004: diff is derived from structured state, not only model prose
- implement-05: execute — satisfy AC-005: affected code/block mapping can be highlighted
- implement-06: execute — satisfy AC-006: malformed provider response is safely rejected
- implement-07: execute — satisfy AC-007: tests cover accept/reject/modify/invalid/stale proposal
- implement-08: execute — satisfy AC-008: stale proposal against changed base state cannot apply silently.
- implement-09: execute — satisfy AC-009: same proposal fixture can render on Web and Studio
- implement-10: execute — satisfy AC-010: accept/reject results produce identical canonical semantics
- implement-11: execute — satisfy AC-011: tablet actions are touch accessible
- implement-12: execute — satisfy AC-012: Studio diff does not become an independent source of truth.
- verify: execute — run targeted verification and collect evidence before review.

## User Stories

- US-001 candidate: proposal cannot mutate program before explicit acceptance
- US-002 candidate: reject preserves exact canonical hash/state
- US-003 candidate: accepted proposal passes canonical validator
- US-004 candidate: diff is derived from structured state, not only model prose
- US-005 candidate: affected code/block mapping can be highlighted
- US-006 candidate: malformed provider response is safely rejected
- US-007 candidate: tests cover accept/reject/modify/invalid/stale proposal
- US-008 candidate: stale proposal against changed base state cannot apply silently.
- US-009 candidate: same proposal fixture can render on Web and Studio
- US-010 candidate: accept/reject results produce identical canonical semantics
- US-011 candidate: tablet actions are touch accessible
- US-012 candidate: Studio diff does not become an independent source of truth.

## Non-functional requirements

- Explicit constraint/NFR candidate: No “Apply automatically” default.

## Measurement Criteria

- MC-001: prove AC-001 with observable verification evidence for: proposal cannot mutate program before explicit acceptance
- MC-002: prove AC-002 with observable verification evidence for: reject preserves exact canonical hash/state
- MC-003: prove AC-003 with observable verification evidence for: accepted proposal passes canonical validator
- MC-004: prove AC-004 with observable verification evidence for: diff is derived from structured state, not only model prose
- MC-005: prove AC-005 with observable verification evidence for: affected code/block mapping can be highlighted
- MC-006: prove AC-006 with observable verification evidence for: malformed provider response is safely rejected
- MC-007: prove AC-007 with observable verification evidence for: tests cover accept/reject/modify/invalid/stale proposal
- MC-008: prove AC-008 with observable verification evidence for: stale proposal against changed base state cannot apply silently.
- MC-009: prove AC-009 with observable verification evidence for: same proposal fixture can render on Web and Studio
- MC-010: prove AC-010 with observable verification evidence for: accept/reject results produce identical canonical semantics
- MC-011: prove AC-011 with observable verification evidence for: tablet actions are touch accessible
- MC-012: prove AC-012 with observable verification evidence for: Studio diff does not become an independent source of truth.

## Proposed Units

- UOW candidate: implement-structured-ai-proposal-preview-diff-and-learner-acceptance-boundary — one cohesive delivery unit for the governed issue.

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

- AC-001: proposal cannot mutate program before explicit acceptance -> plan step implement-01 -> bolt verify-01
- AC-002: reject preserves exact canonical hash/state -> plan step implement-02 -> bolt verify-02
- AC-003: accepted proposal passes canonical validator -> plan step implement-03 -> bolt verify-03
- AC-004: diff is derived from structured state, not only model prose -> plan step implement-04 -> bolt verify-04
- AC-005: affected code/block mapping can be highlighted -> plan step implement-05 -> bolt verify-05
- AC-006: malformed provider response is safely rejected -> plan step implement-06 -> bolt verify-06
- AC-007: tests cover accept/reject/modify/invalid/stale proposal -> plan step implement-07 -> bolt verify-07
- AC-008: stale proposal against changed base state cannot apply silently. -> plan step implement-08 -> bolt verify-08
- AC-009: same proposal fixture can render on Web and Studio -> plan step implement-09 -> bolt verify-09
- AC-010: accept/reject results produce identical canonical semantics -> plan step implement-10 -> bolt verify-10
- AC-011: tablet actions are touch accessible -> plan step implement-11 -> bolt verify-11
- AC-012: Studio diff does not become an independent source of truth. -> plan step implement-12 -> bolt verify-12

## Risk Register

- No “Apply automatically” default.
- No explicit dependency was declared.

## Risks, constraints and dependencies

- No “Apply automatically” default.
- No explicit dependency was declared.

## Source facts and proposed decisions

- Source issue objective: Ensure AI-originated program changes can never mutate canonical state invisibly.
- Pathway: brownfield
- Work: issue-75
- Repository languages: TypeScript, JavaScript
- Build systems: Node, pnpm
- Test files observed: 18
- Files scanned deterministically: 143
- Candidate verification commands: pnpm test
- Proposed decision: keep this deterministic draft non-authoritative until human review.

## Files created or modified

- .agora/ai-sdlc/handoffs/issue-75/DETERMINISTIC_INCEPTION.md (deterministic Inception draft only).

## Human decision required

- Approve, modify or reject this deterministic Inception proposal before Construction.
