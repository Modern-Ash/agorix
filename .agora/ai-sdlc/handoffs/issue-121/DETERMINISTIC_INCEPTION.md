## Intent interpretation

Make “one product, multiple surfaces” a testable invariant.

## Material clarifications

- No material clarification detected from the explicit issue.

## Level 1 Plan

- scope: execute — lock the explicit issue objective, constraints and acceptance criteria.
- implement-01: execute — satisfy AC-001: Web-created project opens in Studio
- implement-02: execute — satisfy AC-002: Studio-created/modified canonical project opens in Web
- implement-03: execute — satisfy AC-003: semantic hash/equivalence preserved through round trip
- implement-04: execute — satisfy AC-004: unsupported newer schema fails explicitly
- implement-05: execute — satisfy AC-005: presentation state does not contaminate program state
- implement-06: execute — satisfy AC-006: locale switch remains independent
- implement-07: execute — satisfy AC-007: no UI-specific identifiers leak into canonical model.
- verify: execute — run targeted verification and collect evidence before review.

## User Stories

- US-001 candidate: Web-created project opens in Studio
- US-002 candidate: Studio-created/modified canonical project opens in Web
- US-003 candidate: semantic hash/equivalence preserved through round trip
- US-004 candidate: unsupported newer schema fails explicitly
- US-005 candidate: presentation state does not contaminate program state
- US-006 candidate: locale switch remains independent
- US-007 candidate: no UI-specific identifiers leak into canonical model.

## Non-functional requirements

- Explicit constraint/NFR candidate: no UI-specific identifiers leak into canonical model.

## Measurement Criteria

- MC-001: prove AC-001 with observable verification evidence for: Web-created project opens in Studio
- MC-002: prove AC-002 with observable verification evidence for: Studio-created/modified canonical project opens in Web
- MC-003: prove AC-003 with observable verification evidence for: semantic hash/equivalence preserved through round trip
- MC-004: prove AC-004 with observable verification evidence for: unsupported newer schema fails explicitly
- MC-005: prove AC-005 with observable verification evidence for: presentation state does not contaminate program state
- MC-006: prove AC-006 with observable verification evidence for: locale switch remains independent
- MC-007: prove AC-007 with observable verification evidence for: no UI-specific identifiers leak into canonical model.

## Proposed Units

- UOW candidate: prove-cross-surface-project-compatibility-between-web-and-agorix-studio — one cohesive delivery unit for the governed issue.

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

- AC-001: Web-created project opens in Studio -> plan step implement-01 -> bolt verify-01
- AC-002: Studio-created/modified canonical project opens in Web -> plan step implement-02 -> bolt verify-02
- AC-003: semantic hash/equivalence preserved through round trip -> plan step implement-03 -> bolt verify-03
- AC-004: unsupported newer schema fails explicitly -> plan step implement-04 -> bolt verify-04
- AC-005: presentation state does not contaminate program state -> plan step implement-05 -> bolt verify-05
- AC-006: locale switch remains independent -> plan step implement-06 -> bolt verify-06
- AC-007: no UI-specific identifiers leak into canonical model. -> plan step implement-07 -> bolt verify-07

## Risk Register

- no UI-specific identifiers leak into canonical model.
- No explicit dependency was declared.

## Risks, constraints and dependencies

- no UI-specific identifiers leak into canonical model.
- No explicit dependency was declared.

## Source facts and proposed decisions

- Source issue objective: Make “one product, multiple surfaces” a testable invariant.
- Pathway: brownfield
- Work: issue-121
- Repository languages: TypeScript, JavaScript
- Build systems: Node, pnpm
- Test files observed: 17
- Files scanned deterministically: 138
- Candidate verification commands: pnpm test
- Proposed decision: keep this deterministic draft non-authoritative until human review.

## Files created or modified

- .agora/ai-sdlc/handoffs/issue-121/DETERMINISTIC_INCEPTION.md (deterministic Inception draft only).

## Human decision required

- Approve, modify or reject this deterministic Inception proposal before Construction.
