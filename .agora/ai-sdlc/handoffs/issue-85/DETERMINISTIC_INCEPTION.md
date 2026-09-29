## Intent interpretation

Replace the narrow tutor-only domain contract with a **LearningCompanion** capability model that supports pedagogical roles without binding the domain to a provider or to separate agents.

## Material clarifications

- No material clarification detected from the explicit issue.

## Level 1 Plan

- scope: execute — lock the explicit issue objective, constraints and acceptance criteria.
- implement-01: execute — satisfy AC-001: existing hint behavior can migrate without provider coupling
- implement-02: execute — satisfy AC-002: builder output cannot be confused with accepted canonical state
- implement-03: execute — satisfy AC-003: debugger context distinguishes facts from model suggestions
- implement-04: execute — satisfy AC-004: malformed responses fail closed
- implement-05: execute — satisfy AC-005: contract supports local and remote providers equally
- implement-06: execute — satisfy AC-006: no child PII required
- implement-07: execute — satisfy AC-007: package has no provider SDK dependency.
- verify: execute — run targeted verification and collect evidence before review.

## User Stories

- US-001 candidate: existing hint behavior can migrate without provider coupling
- US-002 candidate: builder output cannot be confused with accepted canonical state
- US-003 candidate: debugger context distinguishes facts from model suggestions
- US-004 candidate: malformed responses fail closed
- US-005 candidate: contract supports local and remote providers equally
- US-006 candidate: no child PII required
- US-007 candidate: package has no provider SDK dependency.

## Non-functional requirements

- Explicit constraint/NFR candidate: no child PII required
- Explicit constraint/NFR candidate: package has no provider SDK dependency.

## Measurement Criteria

- MC-001: prove AC-001 with observable verification evidence for: existing hint behavior can migrate without provider coupling
- MC-002: prove AC-002 with observable verification evidence for: builder output cannot be confused with accepted canonical state
- MC-003: prove AC-003 with observable verification evidence for: debugger context distinguishes facts from model suggestions
- MC-004: prove AC-004 with observable verification evidence for: malformed responses fail closed
- MC-005: prove AC-005 with observable verification evidence for: contract supports local and remote providers equally
- MC-006: prove AC-006 with observable verification evidence for: no child PII required
- MC-007: prove AC-007 with observable verification evidence for: package has no provider SDK dependency.

## Proposed Units

- UOW candidate: evolve-tutor-contract-into-a-provider-neutral-learningcompanion-capability-contract — one cohesive delivery unit for the governed issue.

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

- AC-001: existing hint behavior can migrate without provider coupling -> plan step implement-01 -> bolt verify-01
- AC-002: builder output cannot be confused with accepted canonical state -> plan step implement-02 -> bolt verify-02
- AC-003: debugger context distinguishes facts from model suggestions -> plan step implement-03 -> bolt verify-03
- AC-004: malformed responses fail closed -> plan step implement-04 -> bolt verify-04
- AC-005: contract supports local and remote providers equally -> plan step implement-05 -> bolt verify-05
- AC-006: no child PII required -> plan step implement-06 -> bolt verify-06
- AC-007: package has no provider SDK dependency. -> plan step implement-07 -> bolt verify-07

## Risk Register

- no child PII required
- package has no provider SDK dependency.
- No explicit dependency was declared.

## Risks, constraints and dependencies

- no child PII required
- package has no provider SDK dependency.
- No explicit dependency was declared.

## Source facts and proposed decisions

- Source issue objective: Replace the narrow tutor-only domain contract with a **LearningCompanion** capability model that supports pedagogical roles without binding the domain to a provider or to separate agents.
- Pathway: brownfield
- Work: issue-85
- Repository languages: TypeScript, JavaScript
- Build systems: Node, pnpm
- Test files observed: 20
- Files scanned deterministically: 156
- Candidate verification commands: pnpm test
- Proposed decision: keep this deterministic draft non-authoritative until human review.

## Files created or modified

- .agora/ai-sdlc/handoffs/issue-85/DETERMINISTIC_INCEPTION.md (deterministic Inception draft only).

## Human decision required

- Approve, modify or reject this deterministic Inception proposal before Construction.
