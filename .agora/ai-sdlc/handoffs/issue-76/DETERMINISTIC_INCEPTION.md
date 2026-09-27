## Intent interpretation

Let the learner execute the program one meaningful instruction at a time and see the exact block and textual code responsible for the behavior.

## Material clarifications

- No material clarification detected from the explicit issue.

## Level 1 Plan

- scope: execute — lock the explicit issue objective, constraints and acceptance criteria.
- implement-01: execute — satisfy AC-001: same canonical program gives same Step sequence
- implement-02: execute — satisfy AC-002: block and active language projection highlight same canonical node
- implement-03: execute — satisfy AC-003: Step cannot race with Run
- implement-04: execute — satisfy AC-004: editing while stepped/executing follows defined stop semantics
- implement-05: execute — satisfy AC-005: Reset restores exact initial state and Step cursor
- implement-06: execute — satisfy AC-006: loops/conditions have documented child-understandable stepping
- implement-07: execute — satisfy AC-007: tests cover simple, repeat and conditional programs
- implement-08: execute — satisfy AC-008: narrow layout remains usable.
- implement-09: execute — satisfy AC-009: tablet touch Step is first-class
- implement-10: execute — satisfy AC-010: Studio and Web produce the same canonical step sequence
- implement-11: execute — satisfy AC-011: viewport/orientation changes do not lose step state
- implement-12: execute — satisfy AC-012: presentation may differ but observations remain identical.
- verify: execute — run targeted verification and collect evidence before review.

## User Stories

- US-001 candidate: same canonical program gives same Step sequence
- US-002 candidate: block and active language projection highlight same canonical node
- US-003 candidate: Step cannot race with Run
- US-004 candidate: editing while stepped/executing follows defined stop semantics
- US-005 candidate: Reset restores exact initial state and Step cursor
- US-006 candidate: loops/conditions have documented child-understandable stepping
- US-007 candidate: tests cover simple, repeat and conditional programs
- US-008 candidate: narrow layout remains usable.
- US-009 candidate: tablet touch Step is first-class
- US-010 candidate: Studio and Web produce the same canonical step sequence
- US-011 candidate: viewport/orientation changes do not lose step state
- US-012 candidate: presentation may differ but observations remain identical.

## Non-functional requirements

- No explicit NFR was found in the source; enrich only if the Intent requires one.

## Measurement Criteria

- MC-001: prove AC-001 with observable verification evidence for: same canonical program gives same Step sequence
- MC-002: prove AC-002 with observable verification evidence for: block and active language projection highlight same canonical node
- MC-003: prove AC-003 with observable verification evidence for: Step cannot race with Run
- MC-004: prove AC-004 with observable verification evidence for: editing while stepped/executing follows defined stop semantics
- MC-005: prove AC-005 with observable verification evidence for: Reset restores exact initial state and Step cursor
- MC-006: prove AC-006 with observable verification evidence for: loops/conditions have documented child-understandable stepping
- MC-007: prove AC-007 with observable verification evidence for: tests cover simple, repeat and conditional programs
- MC-008: prove AC-008 with observable verification evidence for: narrow layout remains usable.
- MC-009: prove AC-009 with observable verification evidence for: tablet touch Step is first-class
- MC-010: prove AC-010 with observable verification evidence for: Studio and Web produce the same canonical step sequence
- MC-011: prove AC-011 with observable verification evidence for: viewport/orientation changes do not lose step state
- MC-012: prove AC-012 with observable verification evidence for: presentation may differ but observations remain identical.

## Proposed Units

- UOW candidate: add-step-execution-with-synchronized-block-and-code-highlighting — one cohesive delivery unit for the governed issue.

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

- AC-001: same canonical program gives same Step sequence -> plan step implement-01 -> bolt verify-01
- AC-002: block and active language projection highlight same canonical node -> plan step implement-02 -> bolt verify-02
- AC-003: Step cannot race with Run -> plan step implement-03 -> bolt verify-03
- AC-004: editing while stepped/executing follows defined stop semantics -> plan step implement-04 -> bolt verify-04
- AC-005: Reset restores exact initial state and Step cursor -> plan step implement-05 -> bolt verify-05
- AC-006: loops/conditions have documented child-understandable stepping -> plan step implement-06 -> bolt verify-06
- AC-007: tests cover simple, repeat and conditional programs -> plan step implement-07 -> bolt verify-07
- AC-008: narrow layout remains usable. -> plan step implement-08 -> bolt verify-08
- AC-009: tablet touch Step is first-class -> plan step implement-09 -> bolt verify-09
- AC-010: Studio and Web produce the same canonical step sequence -> plan step implement-10 -> bolt verify-10
- AC-011: viewport/orientation changes do not lose step state -> plan step implement-11 -> bolt verify-11
- AC-012: presentation may differ but observations remain identical. -> plan step implement-12 -> bolt verify-12

## Risk Register

- No explicit constraint beyond the source issue was detected.
- Existing canonical interpreter (#14), observations (#15), node↔text mapping (#16), editor (#20), and UX contract #74.

## Risks, constraints and dependencies

- No explicit constraint beyond the source issue was detected.
- Existing canonical interpreter (#14), observations (#15), node↔text mapping (#16), editor (#20), and UX contract #74.

## Source facts and proposed decisions

- Source issue objective: Let the learner execute the program one meaningful instruction at a time and see the exact block and textual code responsible for the behavior.
- Pathway: brownfield
- Work: issue-76
- Repository languages: TypeScript, JavaScript
- Build systems: Node, pnpm
- Test files observed: 19
- Files scanned deterministically: 148
- Candidate verification commands: pnpm test
- Proposed decision: keep this deterministic draft non-authoritative until human review.

## Files created or modified

- .agora/ai-sdlc/handoffs/issue-76/DETERMINISTIC_INCEPTION.md (deterministic Inception draft only).

## Human decision required

- Approve, modify or reject this deterministic Inception proposal before Construction.
