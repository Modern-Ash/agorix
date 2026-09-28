## Intent interpretation

Define a pedagogical progression that describes what a learner should understand and do as Agorix gradually moves from blocks to text and from guided AI interaction to greater autonomy.

## Material clarifications

- No material clarification detected from the explicit issue.

## Level 1 Plan

- scope: execute — lock the explicit issue objective, constraints and acceptance criteria.
- implement-01: execute — satisfy AC-001: progression is concept-based, not merely age-based
- implement-02: execute — satisfy AC-002: every stage has observable learner behavior
- implement-03: execute — satisfy AC-003: AI responsibility decreases as learner autonomy increases
- implement-04: execute — satisfy AC-004: progression covers programming and AI literacy
- implement-05: execute — satisfy AC-005: rubric can later drive curriculum metadata and tests
- implement-06: execute — satisfy AC-006: no dependence on a specific provider/model
- implement-07: execute — satisfy AC-007: no “prompt engineering course” framing.
- verify: execute — run targeted verification and collect evidence before review.

## User Stories

- US-001 candidate: progression is concept-based, not merely age-based
- US-002 candidate: every stage has observable learner behavior
- US-003 candidate: AI responsibility decreases as learner autonomy increases
- US-004 candidate: progression covers programming and AI literacy
- US-005 candidate: rubric can later drive curriculum metadata and tests
- US-006 candidate: no dependence on a specific provider/model
- US-007 candidate: no “prompt engineering course” framing.

## Non-functional requirements

- Explicit constraint/NFR candidate: no dependence on a specific provider/model
- Explicit constraint/NFR candidate: no “prompt engineering course” framing.

## Measurement Criteria

- MC-001: prove AC-001 with observable verification evidence for: progression is concept-based, not merely age-based
- MC-002: prove AC-002 with observable verification evidence for: every stage has observable learner behavior
- MC-003: prove AC-003 with observable verification evidence for: AI responsibility decreases as learner autonomy increases
- MC-004: prove AC-004 with observable verification evidence for: progression covers programming and AI literacy
- MC-005: prove AC-005 with observable verification evidence for: rubric can later drive curriculum metadata and tests
- MC-006: prove AC-006 with observable verification evidence for: no dependence on a specific provider/model
- MC-007: prove AC-007 with observable verification evidence for: no “prompt engineering course” framing.

## Proposed Units

- UOW candidate: define-learner-competency-progression-and-adaptive-scaffolding-rubric — one cohesive delivery unit for the governed issue.

## Suggested Bolts

- prepare-contract: sequential — confirm scope, repository facts and deterministic acceptance trace.
- verify-01: sequential — implement and verify AC-001; depends on prior accepted scope.
- verify-02: sequential — implement and verify AC-002; depends on prior accepted scope.
- verify-03: sequential — implement and verify AC-003; depends on prior accepted scope.
- verify-04: sequential — implement and verify AC-004; depends on prior accepted scope.
- verify-05: sequential — implement and verify AC-005; depends on prior accepted scope.
- verify-06: sequential — implement and verify AC-006; depends on prior accepted scope.
- verify-07: sequential — implement and verify AC-007; depends on prior accepted scope.
- final-verification: sequential — run repository checks and collect evidence.

## Acceptance criteria trace

- AC-001: progression is concept-based, not merely age-based -> plan step implement-01 -> bolt verify-01
- AC-002: every stage has observable learner behavior -> plan step implement-02 -> bolt verify-02
- AC-003: AI responsibility decreases as learner autonomy increases -> plan step implement-03 -> bolt verify-03
- AC-004: progression covers programming and AI literacy -> plan step implement-04 -> bolt verify-04
- AC-005: rubric can later drive curriculum metadata and tests -> plan step implement-05 -> bolt verify-05
- AC-006: no dependence on a specific provider/model -> plan step implement-06 -> bolt verify-06
- AC-007: no “prompt engineering course” framing. -> plan step implement-07 -> bolt verify-07

## Risk Register

- no dependence on a specific provider/model
- no “prompt engineering course” framing.
- No explicit dependency was declared.

## Risks, constraints and dependencies

- no dependence on a specific provider/model
- no “prompt engineering course” framing.
- No explicit dependency was declared.

## Source facts and proposed decisions

- Source issue objective: Define a pedagogical progression that describes what a learner should understand and do as Agorix gradually moves from blocks to text and from guided AI interaction to greater autonomy.
- Pathway: documentation
- Work: issue-70
- Repository languages: TypeScript, JavaScript
- Build systems: Node, pnpm
- Test files observed: 16
- Files scanned deterministically: 106
- Candidate verification commands: pnpm test
- Proposed decision: keep this deterministic draft non-authoritative until human review.

## Files created or modified

- .agora/ai-sdlc/handoffs/issue-70/DETERMINISTIC_INCEPTION.md (deterministic Inception draft only).

## Human decision required

- Approve, modify or reject this deterministic Inception proposal before Construction.
