## Intent interpretation

Rewrite the core product/pedagogy sources so Agorix is explicitly an **open-source, AI-native programming learning environment for children**, not a block editor with an optional chatbot.

## Material clarifications

- No material clarification detected from the explicit issue.

## Level 1 Plan

- scope: execute — lock the explicit issue objective, constraints and acceptance criteria.
- implement-01: execute — satisfy AC-001: documents no longer define AI primarily as “optional help when stuck”
- implement-02: execute — satisfy AC-002: a reader can explain how Agorix differs from Scratch + chatbot
- implement-03: execute — satisfy AC-003: learner agency is testable, not aspirational
- implement-04: execute — satisfy AC-004: runtime remains objective authority for execution
- implement-05: execute — satisfy AC-005: no hidden code-generation path is permitted
- implement-06: execute — satisfy AC-006: the learner loop includes explanation/reflection
- implement-07: execute — satisfy AC-007: terminology is internally consistent across the three source-of-truth documents
- implement-08: execute — satisfy AC-008: explicit unresolved decisions are recorded rather than invented silently.
- verify: execute — run targeted verification and collect evidence before review.

## User Stories

- US-001 candidate: documents no longer define AI primarily as “optional help when stuck”
- US-002 candidate: a reader can explain how Agorix differs from Scratch + chatbot
- US-003 candidate: learner agency is testable, not aspirational
- US-004 candidate: runtime remains objective authority for execution
- US-005 candidate: no hidden code-generation path is permitted
- US-006 candidate: the learner loop includes explanation/reflection
- US-007 candidate: terminology is internally consistent across the three source-of-truth documents
- US-008 candidate: explicit unresolved decisions are recorded rather than invented silently.

## Non-functional requirements

- Explicit constraint/NFR candidate: documents no longer define AI primarily as “optional help when stuck”
- Explicit constraint/NFR candidate: no hidden code-generation path is permitted

## Measurement Criteria

- MC-001: prove AC-001 with observable verification evidence for: documents no longer define AI primarily as “optional help when stuck”
- MC-002: prove AC-002 with observable verification evidence for: a reader can explain how Agorix differs from Scratch + chatbot
- MC-003: prove AC-003 with observable verification evidence for: learner agency is testable, not aspirational
- MC-004: prove AC-004 with observable verification evidence for: runtime remains objective authority for execution
- MC-005: prove AC-005 with observable verification evidence for: no hidden code-generation path is permitted
- MC-006: prove AC-006 with observable verification evidence for: the learner loop includes explanation/reflection
- MC-007: prove AC-007 with observable verification evidence for: terminology is internally consistent across the three source-of-truth documents
- MC-008: prove AC-008 with observable verification evidence for: explicit unresolved decisions are recorded rather than invented silently.

## Proposed Units

- UOW candidate: rewrite-product-intent-pedagogy-and-learner-journey-for-ai-native-programming — one cohesive delivery unit for the governed issue.

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

- AC-001: documents no longer define AI primarily as “optional help when stuck” -> plan step implement-01 -> bolt verify-01
- AC-002: a reader can explain how Agorix differs from Scratch + chatbot -> plan step implement-02 -> bolt verify-02
- AC-003: learner agency is testable, not aspirational -> plan step implement-03 -> bolt verify-03
- AC-004: runtime remains objective authority for execution -> plan step implement-04 -> bolt verify-04
- AC-005: no hidden code-generation path is permitted -> plan step implement-05 -> bolt verify-05
- AC-006: the learner loop includes explanation/reflection -> plan step implement-06 -> bolt verify-06
- AC-007: terminology is internally consistent across the three source-of-truth documents -> plan step implement-07 -> bolt verify-07
- AC-008: explicit unresolved decisions are recorded rather than invented silently. -> plan step implement-08 -> bolt verify-08

## Risk Register

- documents no longer define AI primarily as “optional help when stuck”
- no hidden code-generation path is permitted
- No explicit dependency was declared.

## Risks, constraints and dependencies

- documents no longer define AI primarily as “optional help when stuck”
- no hidden code-generation path is permitted
- No explicit dependency was declared.

## Source facts and proposed decisions

- Source issue objective: Rewrite the core product/pedagogy sources so Agorix is explicitly an **open-source, AI-native programming learning environment for children**, not a block editor with an optional chatbot.
- Pathway: brownfield
- Work: issue-69
- Repository languages: TypeScript, JavaScript
- Build systems: Node, pnpm
- Test files observed: 16
- Files scanned deterministically: 106
- Candidate verification commands: pnpm test
- Proposed decision: keep this deterministic draft non-authoritative until human review.

## Files created or modified

- .agora/ai-sdlc/handoffs/issue-69/DETERMINISTIC_INCEPTION.md (deterministic Inception draft only).

## Human decision required

- Approve, modify or reject this deterministic Inception proposal before Construction.
