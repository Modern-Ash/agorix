## Intent interpretation

Define what Agorix should record as evidence that the learner is understanding, rather than merely completing tasks with AI assistance.

## Material clarifications

- No material clarification detected from the explicit issue.

## Level 1 Plan

- scope: execute — lock the explicit issue objective, constraints and acceptance criteria.
- implement-01: execute — satisfy AC-001: evidence maps to competencies from #70
- implement-02: execute — satisfy AC-002: model distinguishes completion from understanding
- implement-03: execute — satisfy AC-003: AI assistance level is visible in interpretation
- implement-04: execute — satisfy AC-004: no sensitive profiling required
- implement-05: execute — satisfy AC-005: data fields and retention assumptions documented
- implement-06: execute — satisfy AC-006: metrics cannot reward over-assistance by default.
- verify: execute — run targeted verification and collect evidence before review.

## User Stories

- US-001 candidate: evidence maps to competencies from #70
- US-002 candidate: model distinguishes completion from understanding
- US-003 candidate: AI assistance level is visible in interpretation
- US-004 candidate: no sensitive profiling required
- US-005 candidate: data fields and retention assumptions documented
- US-006 candidate: metrics cannot reward over-assistance by default.

## Non-functional requirements

- Explicit constraint/NFR candidate: no sensitive profiling required

## Measurement Criteria

- MC-001: prove AC-001 with observable verification evidence for: evidence maps to competencies from #70
- MC-002: prove AC-002 with observable verification evidence for: model distinguishes completion from understanding
- MC-003: prove AC-003 with observable verification evidence for: AI assistance level is visible in interpretation
- MC-004: prove AC-004 with observable verification evidence for: no sensitive profiling required
- MC-005: prove AC-005 with observable verification evidence for: data fields and retention assumptions documented
- MC-006: prove AC-006 with observable verification evidence for: metrics cannot reward over-assistance by default.

## Proposed Units

- UOW candidate: define-learning-evidence-and-assessment-model-for-programming-plus-ai-literacy — one cohesive delivery unit for the governed issue.

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

- AC-001: evidence maps to competencies from #70 -> plan step implement-01 -> bolt verify-01
- AC-002: model distinguishes completion from understanding -> plan step implement-02 -> bolt verify-02
- AC-003: AI assistance level is visible in interpretation -> plan step implement-03 -> bolt verify-03
- AC-004: no sensitive profiling required -> plan step implement-04 -> bolt verify-04
- AC-005: data fields and retention assumptions documented -> plan step implement-05 -> bolt verify-05
- AC-006: metrics cannot reward over-assistance by default. -> plan step implement-06 -> bolt verify-06

## Risk Register

- no sensitive profiling required
- No explicit dependency was declared.

## Risks, constraints and dependencies

- no sensitive profiling required
- No explicit dependency was declared.

## Source facts and proposed decisions

- Source issue objective: Define what Agorix should record as evidence that the learner is understanding, rather than merely completing tasks with AI assistance.
- Pathway: documentation
- Work: issue-102
- Repository languages: TypeScript, JavaScript
- Build systems: Node, pnpm
- Test files observed: 28
- Files scanned deterministically: 189
- Candidate verification commands: pnpm test
- Proposed decision: keep this deterministic draft non-authoritative until human review.

## Files created or modified

- .agora/ai-sdlc/handoffs/issue-102/DETERMINISTIC_INCEPTION.md (deterministic Inception draft only).

## Human decision required

- Approve, modify or reject this deterministic Inception proposal before Construction.
