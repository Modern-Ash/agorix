## Intent interpretation

Deliver Agorix Web as an installable, tablet-first PWA optimized for touch, missions, Worlds and visible code.

## Material clarifications

- No material clarification detected from the explicit issue.

## Level 1 Plan

- scope: execute — lock the explicit issue objective, constraints and acceptance criteria.
- implement-01: execute — satisfy AC-001: PWA installability requirements pass
- implement-02: execute — satisfy AC-002: First Mission works touch-only
- implement-03: execute — satisfy AC-003: code remains inspectable in portrait and landscape
- implement-04: execute — satisfy AC-004: World + Code dominate layout
- implement-05: execute — satisfy AC-005: AI proposal flow is usable by touch
- implement-06: execute — satisfy AC-006: Step execution remains visible
- implement-07: execute — satisfy AC-007: locale switching from #110 works
- implement-08: execute — satisfy AC-008: offline/provider-unavailable behavior follows #96
- implement-09: execute — satisfy AC-009: Playwright covers tablet portrait and landscape.
- verify: execute — run targeted verification and collect evidence before review.

## User Stories

- US-001 candidate: PWA installability requirements pass
- US-002 candidate: First Mission works touch-only
- US-003 candidate: code remains inspectable in portrait and landscape
- US-004 candidate: World + Code dominate layout
- US-005 candidate: AI proposal flow is usable by touch
- US-006 candidate: Step execution remains visible
- US-007 candidate: locale switching from #110 works
- US-008 candidate: offline/provider-unavailable behavior follows #96
- US-009 candidate: Playwright covers tablet portrait and landscape.

## Non-functional requirements

- No explicit NFR was found in the source; enrich only if the Intent requires one.

## Measurement Criteria

- MC-001: prove AC-001 with observable verification evidence for: PWA installability requirements pass
- MC-002: prove AC-002 with observable verification evidence for: First Mission works touch-only
- MC-003: prove AC-003 with observable verification evidence for: code remains inspectable in portrait and landscape
- MC-004: prove AC-004 with observable verification evidence for: World + Code dominate layout
- MC-005: prove AC-005 with observable verification evidence for: AI proposal flow is usable by touch
- MC-006: prove AC-006 with observable verification evidence for: Step execution remains visible
- MC-007: prove AC-007 with observable verification evidence for: locale switching from #110 works
- MC-008: prove AC-008 with observable verification evidence for: offline/provider-unavailable behavior follows #96
- MC-009: prove AC-009 with observable verification evidence for: Playwright covers tablet portrait and landscape.

## Proposed Units

- UOW candidate: build-tablet-first-installable-web-pwa-learning-surface — one cohesive delivery unit for the governed issue.

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
- final-verification: sequential — run repository checks and collect evidence.

## Acceptance criteria trace

- AC-001: PWA installability requirements pass -> plan step implement-01 -> bolt verify-01
- AC-002: First Mission works touch-only -> plan step implement-02 -> bolt verify-02
- AC-003: code remains inspectable in portrait and landscape -> plan step implement-03 -> bolt verify-03
- AC-004: World + Code dominate layout -> plan step implement-04 -> bolt verify-04
- AC-005: AI proposal flow is usable by touch -> plan step implement-05 -> bolt verify-05
- AC-006: Step execution remains visible -> plan step implement-06 -> bolt verify-06
- AC-007: locale switching from #110 works -> plan step implement-07 -> bolt verify-07
- AC-008: offline/provider-unavailable behavior follows #96 -> plan step implement-08 -> bolt verify-08
- AC-009: Playwright covers tablet portrait and landscape. -> plan step implement-09 -> bolt verify-09

## Risk Register

- No explicit constraint beyond the source issue was detected.
- No explicit dependency was declared.

## Risks, constraints and dependencies

- No explicit constraint beyond the source issue was detected.
- No explicit dependency was declared.

## Source facts and proposed decisions

- Source issue objective: Deliver Agorix Web as an installable, tablet-first PWA optimized for touch, missions, Worlds and visible code.
- Pathway: brownfield
- Work: issue-36
- Repository languages: TypeScript, JavaScript
- Build systems: Node, pnpm
- Test files observed: 26
- Files scanned deterministically: 181
- Candidate verification commands: pnpm test
- Proposed decision: keep this deterministic draft non-authoritative until human review.

## Files created or modified

- .agora/ai-sdlc/handoffs/issue-36/DETERMINISTIC_INCEPTION.md (deterministic Inception draft only).

## Human decision required

- Approve, modify or reject this deterministic Inception proposal before Construction.
