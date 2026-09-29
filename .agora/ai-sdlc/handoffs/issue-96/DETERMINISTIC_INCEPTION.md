## Intent interpretation

Select providers by required pedagogical capability while keeping Agorix usable when no LLM is available.

## Material clarifications

- No material clarification detected from the explicit issue.

## Level 1 Plan

- scope: execute — lock the explicit issue objective, constraints and acceptance criteria.
- implement-01: execute — satisfy AC-001: capability-aware selection tested
- implement-02: execute — satisfy AC-002: preferred provider unavailable -> documented fallback
- implement-03: execute — satisfy AC-003: no compatible provider -> clear unavailable state
- implement-04: execute — satisfy AC-004: offline mode does not call network
- implement-05: execute — satisfy AC-005: canonical/runtime behavior unchanged
- implement-06: execute — satisfy AC-006: child-facing copy avoids technical provider jargon by default
- implement-07: execute — satisfy AC-007: developer diagnostics expose selected runtime/model safely.
- verify: execute — run targeted verification and collect evidence before review.

## User Stories

- US-001 candidate: capability-aware selection tested
- US-002 candidate: preferred provider unavailable -> documented fallback
- US-003 candidate: no compatible provider -> clear unavailable state
- US-004 candidate: offline mode does not call network
- US-005 candidate: canonical/runtime behavior unchanged
- US-006 candidate: child-facing copy avoids technical provider jargon by default
- US-007 candidate: developer diagnostics expose selected runtime/model safely.

## Non-functional requirements

- Explicit constraint/NFR candidate: no compatible provider -> clear unavailable state

## Measurement Criteria

- MC-001: prove AC-001 with observable verification evidence for: capability-aware selection tested
- MC-002: prove AC-002 with observable verification evidence for: preferred provider unavailable -> documented fallback
- MC-003: prove AC-003 with observable verification evidence for: no compatible provider -> clear unavailable state
- MC-004: prove AC-004 with observable verification evidence for: offline mode does not call network
- MC-005: prove AC-005 with observable verification evidence for: canonical/runtime behavior unchanged
- MC-006: prove AC-006 with observable verification evidence for: child-facing copy avoids technical provider jargon by default
- MC-007: prove AC-007 with observable verification evidence for: developer diagnostics expose selected runtime/model safely.

## Proposed Units

- UOW candidate: implement-provider-selection-capability-fallback-and-meaningful-offline-mode — one cohesive delivery unit for the governed issue.

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

- AC-001: capability-aware selection tested -> plan step implement-01 -> bolt verify-01
- AC-002: preferred provider unavailable -> documented fallback -> plan step implement-02 -> bolt verify-02
- AC-003: no compatible provider -> clear unavailable state -> plan step implement-03 -> bolt verify-03
- AC-004: offline mode does not call network -> plan step implement-04 -> bolt verify-04
- AC-005: canonical/runtime behavior unchanged -> plan step implement-05 -> bolt verify-05
- AC-006: child-facing copy avoids technical provider jargon by default -> plan step implement-06 -> bolt verify-06
- AC-007: developer diagnostics expose selected runtime/model safely. -> plan step implement-07 -> bolt verify-07

## Risk Register

- no compatible provider -> clear unavailable state
- No explicit dependency was declared.

## Risks, constraints and dependencies

- no compatible provider -> clear unavailable state
- No explicit dependency was declared.

## Source facts and proposed decisions

- Source issue objective: Select providers by required pedagogical capability while keeping Agorix usable when no LLM is available.
- Pathway: brownfield
- Work: issue-96
- Repository languages: TypeScript, JavaScript
- Build systems: Node, pnpm
- Test files observed: 26
- Files scanned deterministically: 181
- Candidate verification commands: pnpm test
- Proposed decision: keep this deterministic draft non-authoritative until human review.

## Files created or modified

- .agora/ai-sdlc/handoffs/issue-96/DETERMINISTIC_INCEPTION.md (deterministic Inception draft only).

## Human decision required

- Approve, modify or reject this deterministic Inception proposal before Construction.
