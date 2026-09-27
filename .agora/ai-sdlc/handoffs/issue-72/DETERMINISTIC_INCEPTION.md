## Intent interpretation

Update repository execution contracts so every human or AI developer is prevented from reintroducing the old “hidden assistant” model.

## Material clarifications

- No material clarification detected from the explicit issue.

## Level 1 Plan

- scope: execute — lock the explicit issue objective, constraints and acceptance criteria.
- implement-01: execute — satisfy AC-001: an agent reading AGENTS.md cannot reasonably implement silent AI code edits
- implement-02: execute — satisfy AC-002: domain packages remain provider/UI independent
- implement-03: execute — satisfy AC-003: old tutor terminology is either deliberately retained for a narrow capability or superseded clearly
- implement-04: execute — satisfy AC-004: architecture diagram shows AI proposal path separately from runtime execution
- implement-05: execute — satisfy AC-005: no generated provider code is executed directly
- implement-06: execute — satisfy AC-006: repository remains buildable without credentials.
- verify: execute — run targeted verification and collect evidence before review.

## User Stories

- US-001 candidate: an agent reading AGENTS.md cannot reasonably implement silent AI code edits
- US-002 candidate: domain packages remain provider/UI independent
- US-003 candidate: old tutor terminology is either deliberately retained for a narrow capability or superseded clearly
- US-004 candidate: architecture diagram shows AI proposal path separately from runtime execution
- US-005 candidate: no generated provider code is executed directly
- US-006 candidate: repository remains buildable without credentials.

## Non-functional requirements

- Explicit constraint/NFR candidate: no generated provider code is executed directly

## Measurement Criteria

- MC-001: prove AC-001 with observable verification evidence for: an agent reading AGENTS.md cannot reasonably implement silent AI code edits
- MC-002: prove AC-002 with observable verification evidence for: domain packages remain provider/UI independent
- MC-003: prove AC-003 with observable verification evidence for: old tutor terminology is either deliberately retained for a narrow capability or superseded clearly
- MC-004: prove AC-004 with observable verification evidence for: architecture diagram shows AI proposal path separately from runtime execution
- MC-005: prove AC-005 with observable verification evidence for: no generated provider code is executed directly
- MC-006: prove AC-006 with observable verification evidence for: repository remains buildable without credentials.

## Proposed Units

- UOW candidate: update-agents-and-architecture-invariants-for-transparent-ai-native-learning — one cohesive delivery unit for the governed issue.

## Suggested Bolts

- prepare-contract: sequential — confirm scope, repository facts and deterministic acceptance trace.
- verify-01: sequential — implement and verify AC-001; depends on prior accepted scope.
- verify-02: sequential — implement and verify AC-002; depends on prior accepted scope.
- verify-03: sequential — implement and verify AC-003; depends on prior accepted scope.
- verify-04: sequential — implement and verify AC-004; depends on prior accepted scope.
- verify-05: sequential — implement and verify AC-005; depends on prior accepted scope.
- verify-06: sequential — implement and verify AC-006; depends on prior accepted scope.
- final-verification: sequential — run repository checks and collect evidence.

## Acceptance criteria trace

- AC-001: an agent reading AGENTS.md cannot reasonably implement silent AI code edits -> plan step implement-01 -> bolt verify-01
- AC-002: domain packages remain provider/UI independent -> plan step implement-02 -> bolt verify-02
- AC-003: old tutor terminology is either deliberately retained for a narrow capability or superseded clearly -> plan step implement-03 -> bolt verify-03
- AC-004: architecture diagram shows AI proposal path separately from runtime execution -> plan step implement-04 -> bolt verify-04
- AC-005: no generated provider code is executed directly -> plan step implement-05 -> bolt verify-05
- AC-006: repository remains buildable without credentials. -> plan step implement-06 -> bolt verify-06

## Risk Register

- no generated provider code is executed directly
- No explicit dependency was declared.

## Risks, constraints and dependencies

- no generated provider code is executed directly
- No explicit dependency was declared.

## Source facts and proposed decisions

- Source issue objective: Update repository execution contracts so every human or AI developer is prevented from reintroducing the old “hidden assistant” model.
- Pathway: brownfield
- Work: issue-72
- Repository languages: TypeScript, JavaScript
- Build systems: Node, pnpm
- Test files observed: 16
- Files scanned deterministically: 119
- Candidate verification commands: pnpm test
- Proposed decision: keep this deterministic draft non-authoritative until human review.

## Files created or modified

- .agora/ai-sdlc/handoffs/issue-72/DETERMINISTIC_INCEPTION.md (deterministic Inception draft only).

## Human decision required

- Approve, modify or reject this deterministic Inception proposal before Construction.
