## Intent interpretation

Replace the current desktop-editor-first shell with a **tablet-first learning surface** where World + Code are the two dominant persistent surfaces.

## Material clarifications

- No material clarification detected from the explicit issue.

## Level 1 Plan

- scope: execute — lock the explicit issue objective, constraints and acceptance criteria.
- implement-01: execute — satisfy AC-001: tablet landscape is first-class
- implement-02: execute — satisfy AC-002: tablet portrait is functional
- implement-03: execute — satisfy AC-003: code remains visible/inspectable in both orientations
- implement-04: execute — satisfy AC-004: World is visually primary
- implement-05: execute — satisfy AC-005: controls meet touch target guidance
- implement-06: execute — satisfy AC-006: orientation change preserves canonical state
- implement-07: execute — satisfy AC-007: no permanent toolbox consumes major screen width
- implement-08: execute — satisfy AC-008: no permanent full-height tutor panel required for normal flow
- implement-09: execute — satisfy AC-009: keyboard and touch navigation both work
- implement-10: execute — satisfy AC-010: Playwright covers tablet landscape + portrait.
- verify: execute — run targeted verification and collect evidence before review.

## User Stories

- US-001 candidate: tablet landscape is first-class
- US-002 candidate: tablet portrait is functional
- US-003 candidate: code remains visible/inspectable in both orientations
- US-004 candidate: World is visually primary
- US-005 candidate: controls meet touch target guidance
- US-006 candidate: orientation change preserves canonical state
- US-007 candidate: no permanent toolbox consumes major screen width
- US-008 candidate: no permanent full-height tutor panel required for normal flow
- US-009 candidate: keyboard and touch navigation both work
- US-010 candidate: Playwright covers tablet landscape + portrait.

## Non-functional requirements

- Explicit constraint/NFR candidate: virtual keyboard must not destroy critical controls
- Explicit constraint/NFR candidate: no hover-only interaction.
- Explicit constraint/NFR candidate: no permanent toolbox consumes major screen width
- Explicit constraint/NFR candidate: no permanent full-height tutor panel required for normal flow

## Measurement Criteria

- MC-001: prove AC-001 with observable verification evidence for: tablet landscape is first-class
- MC-002: prove AC-002 with observable verification evidence for: tablet portrait is functional
- MC-003: prove AC-003 with observable verification evidence for: code remains visible/inspectable in both orientations
- MC-004: prove AC-004 with observable verification evidence for: World is visually primary
- MC-005: prove AC-005 with observable verification evidence for: controls meet touch target guidance
- MC-006: prove AC-006 with observable verification evidence for: orientation change preserves canonical state
- MC-007: prove AC-007 with observable verification evidence for: no permanent toolbox consumes major screen width
- MC-008: prove AC-008 with observable verification evidence for: no permanent full-height tutor panel required for normal flow
- MC-009: prove AC-009 with observable verification evidence for: keyboard and touch navigation both work
- MC-010: prove AC-010 with observable verification evidence for: Playwright covers tablet landscape + portrait.

## Proposed Units

- UOW candidate: build-tablet-first-agorix-web-application-shell — one cohesive delivery unit for the governed issue.

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
- final-verification: sequential — run repository checks and collect evidence.

## Acceptance criteria trace

- AC-001: tablet landscape is first-class -> plan step implement-01 -> bolt verify-01
- AC-002: tablet portrait is functional -> plan step implement-02 -> bolt verify-02
- AC-003: code remains visible/inspectable in both orientations -> plan step implement-03 -> bolt verify-03
- AC-004: World is visually primary -> plan step implement-04 -> bolt verify-04
- AC-005: controls meet touch target guidance -> plan step implement-05 -> bolt verify-05
- AC-006: orientation change preserves canonical state -> plan step implement-06 -> bolt verify-06
- AC-007: no permanent toolbox consumes major screen width -> plan step implement-07 -> bolt verify-07
- AC-008: no permanent full-height tutor panel required for normal flow -> plan step implement-08 -> bolt verify-08
- AC-009: keyboard and touch navigation both work -> plan step implement-09 -> bolt verify-09
- AC-010: Playwright covers tablet landscape + portrait. -> plan step implement-10 -> bolt verify-10

## Risk Register

- virtual keyboard must not destroy critical controls
- no hover-only interaction.
- no permanent toolbox consumes major screen width
- no permanent full-height tutor panel required for normal flow
- design system issue under #116

## Risks, constraints and dependencies

- virtual keyboard must not destroy critical controls
- no hover-only interaction.
- no permanent toolbox consumes major screen width
- no permanent full-height tutor panel required for normal flow
- design system issue under #116

## Source facts and proposed decisions

- Source issue objective: Replace the current desktop-editor-first shell with a **tablet-first learning surface** where World + Code are the two dominant persistent surfaces.
- Pathway: brownfield
- Work: issue-118
- Repository languages: TypeScript, JavaScript
- Build systems: Node, pnpm
- Test files observed: 16
- Files scanned deterministically: 128
- Candidate verification commands: pnpm test
- Proposed decision: keep this deterministic draft non-authoritative until human review.

## Files created or modified

- .agora/ai-sdlc/handoffs/issue-118/DETERMINISTIC_INCEPTION.md (deterministic Inception draft only).

## Human decision required

- Approve, modify or reject this deterministic Inception proposal before Construction.
