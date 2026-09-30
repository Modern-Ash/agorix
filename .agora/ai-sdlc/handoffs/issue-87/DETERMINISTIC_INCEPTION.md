## Intent interpretation

Create the domain protocol used whenever AI proposes a program change.

## Material clarifications

- No material clarification detected from the explicit issue.

## Level 1 Plan

- scope: execute — lock the explicit issue objective, constraints and acceptance criteria.
- implement-01: execute — satisfy AC-001: stale proposal cannot apply to changed base
- implement-02: execute — satisfy AC-002: unknown operation rejected
- implement-03: execute — satisfy AC-003: resulting program must validate
- implement-04: execute — satisfy AC-004: deterministic diff generated independently from model prose
- implement-05: execute — satisfy AC-005: proposal can be serialized/audited without PII
- implement-06: execute — satisfy AC-006: no provider SDK types leak into protocol
- implement-07: execute — satisfy AC-007: tests cover insert/change/remove/stale/invalid
- implement-08: execute — satisfy AC-008: integrates with UI boundary from #75.
- verify: execute — run targeted verification and collect evidence before review.

## User Stories

- US-001 candidate: stale proposal cannot apply to changed base
- US-002 candidate: unknown operation rejected
- US-003 candidate: resulting program must validate
- US-004 candidate: deterministic diff generated independently from model prose
- US-005 candidate: proposal can be serialized/audited without PII
- US-006 candidate: no provider SDK types leak into protocol
- US-007 candidate: tests cover insert/change/remove/stale/invalid
- US-008 candidate: integrates with UI boundary from #75.

## Non-functional requirements

- Explicit constraint/NFR candidate: no executable arbitrary code payload as authority.
- Explicit constraint/NFR candidate: no provider SDK types leak into protocol

## Measurement Criteria

- MC-001: prove AC-001 with observable verification evidence for: stale proposal cannot apply to changed base
- MC-002: prove AC-002 with observable verification evidence for: unknown operation rejected
- MC-003: prove AC-003 with observable verification evidence for: resulting program must validate
- MC-004: prove AC-004 with observable verification evidence for: deterministic diff generated independently from model prose
- MC-005: prove AC-005 with observable verification evidence for: proposal can be serialized/audited without PII
- MC-006: prove AC-006 with observable verification evidence for: no provider SDK types leak into protocol
- MC-007: prove AC-007 with observable verification evidence for: tests cover insert/change/remove/stale/invalid
- MC-008: prove AC-008 with observable verification evidence for: integrates with UI boundary from #75.

## Proposed Units

- UOW candidate: define-and-implement-structured-programproposal-protocol-for-ai-generated-changes — one cohesive delivery unit for the governed issue.

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
- final-verification: sequential — run repository checks and collect evidence.

## Acceptance criteria trace

- AC-001: stale proposal cannot apply to changed base -> plan step implement-01 -> bolt verify-01
- AC-002: unknown operation rejected -> plan step implement-02 -> bolt verify-02
- AC-003: resulting program must validate -> plan step implement-03 -> bolt verify-03
- AC-004: deterministic diff generated independently from model prose -> plan step implement-04 -> bolt verify-04
- AC-005: proposal can be serialized/audited without PII -> plan step implement-05 -> bolt verify-05
- AC-006: no provider SDK types leak into protocol -> plan step implement-06 -> bolt verify-06
- AC-007: tests cover insert/change/remove/stale/invalid -> plan step implement-07 -> bolt verify-07
- AC-008: integrates with UI boundary from #75. -> plan step implement-08 -> bolt verify-08

## Risk Register

- no executable arbitrary code payload as authority.
- no provider SDK types leak into protocol
- No explicit dependency was declared.

## Risks, constraints and dependencies

- no executable arbitrary code payload as authority.
- no provider SDK types leak into protocol
- No explicit dependency was declared.

## Source facts and proposed decisions

- Source issue objective: Create the domain protocol used whenever AI proposes a program change.
- Pathway: brownfield
- Work: issue-87
- Repository languages: TypeScript, JavaScript
- Build systems: Node, pnpm
- Test files observed: 16
- Files scanned deterministically: 106
- Candidate verification commands: pnpm test
- Proposed decision: keep this deterministic draft non-authoritative until human review.

## Files created or modified

- .agora/ai-sdlc/handoffs/issue-87/DETERMINISTIC_INCEPTION.md (deterministic Inception draft only).

## Human decision required

- Approve, modify or reject this deterministic Inception proposal before Construction.
