## Intent interpretation

Make Agorix a **multilingual learning product** so children can use the platform, missions, feedback and AI Learning Companion in their own language without changing programming semantics or creating locale-specific forks.

## Material clarifications

- No material clarification detected from the explicit issue.

## Level 1 Plan

- scope: execute — lock the explicit issue objective, constraints and acceptance criteria.
- implement-01: execute — satisfy AC-001: English and Spanish are both selectable in the application
- implement-02: execute — satisfy AC-002: switching locale does not change canonical program hash/semantics
- implement-03: execute — satisfy AC-003: First Mission is complete in both locales
- implement-04: execute — satisfy AC-004: Run/Step/Stop/Reset, proposal review and execution evidence are localized
- implement-05: execute — satisfy AC-005: deterministic fake Learning Companion works in both locales
- implement-06: execute — satisfy AC-006: real-provider requests carry locale explicitly
- implement-07: execute — satisfy AC-007: AI structured fields remain locale-independent
- implement-08: execute — satisfy AC-008: safety-critical copy exists and is reviewed in both locales
- implement-09: execute — satisfy AC-009: no core learner-facing UI strings are hard-coded outside localization resources
- implement-10: execute — satisfy AC-010: locale fallback is deterministic and tested
- implement-11: execute — satisfy AC-011: missing translation keys fail CI or produce an explicit developer diagnostic
- implement-12: execute — satisfy AC-012: adding a third locale does not require changing canonical program/runtime code
- implement-13: execute — satisfy AC-013: README.md and README.es.md provide equivalent product information.
- verify: execute — run targeted verification and collect evidence before review.

## User Stories

- US-001 candidate: English and Spanish are both selectable in the application
- US-002 candidate: switching locale does not change canonical program hash/semantics
- US-003 candidate: First Mission is complete in both locales
- US-004 candidate: Run/Step/Stop/Reset, proposal review and execution evidence are localized
- US-005 candidate: deterministic fake Learning Companion works in both locales
- US-006 candidate: real-provider requests carry locale explicitly
- US-007 candidate: AI structured fields remain locale-independent
- US-008 candidate: safety-critical copy exists and is reviewed in both locales
- US-009 candidate: no core learner-facing UI strings are hard-coded outside localization resources
- US-010 candidate: locale fallback is deterministic and tested
- US-011 candidate: missing translation keys fail CI or produce an explicit developer diagnostic
- US-012 candidate: adding a third locale does not require changing canonical program/runtime code
- US-013 candidate: README.md and README.es.md provide equivalent product information.

## Non-functional requirements

- Explicit constraint/NFR candidate: locale change must not require restarting the mission
- Explicit constraint/NFR candidate: no core learner-facing UI strings are hard-coded outside localization resources

## Measurement Criteria

- MC-001: prove AC-001 with observable verification evidence for: English and Spanish are both selectable in the application
- MC-002: prove AC-002 with observable verification evidence for: switching locale does not change canonical program hash/semantics
- MC-003: prove AC-003 with observable verification evidence for: First Mission is complete in both locales
- MC-004: prove AC-004 with observable verification evidence for: Run/Step/Stop/Reset, proposal review and execution evidence are localized
- MC-005: prove AC-005 with observable verification evidence for: deterministic fake Learning Companion works in both locales
- MC-006: prove AC-006 with observable verification evidence for: real-provider requests carry locale explicitly
- MC-007: prove AC-007 with observable verification evidence for: AI structured fields remain locale-independent
- MC-008: prove AC-008 with observable verification evidence for: safety-critical copy exists and is reviewed in both locales
- MC-009: prove AC-009 with observable verification evidence for: no core learner-facing UI strings are hard-coded outside localization resources
- MC-010: prove AC-010 with observable verification evidence for: locale fallback is deterministic and tested
- MC-011: prove AC-011 with observable verification evidence for: missing translation keys fail CI or produce an explicit developer diagnostic
- MC-012: prove AC-012 with observable verification evidence for: adding a third locale does not require changing canonical program/runtime code
- MC-013: prove AC-013 with observable verification evidence for: README.md and README.es.md provide equivalent product information.

## Proposed Units

- UOW candidate: make-agorix-multilingual-ui-curriculum-and-learning-companion-i18n-l10n — one cohesive delivery unit for the governed issue.

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
- verify-13: sequential — implement and verify AC-013; depends on prior accepted scope.
- final-verification: sequential — run repository checks and collect evidence.

## Acceptance criteria trace

- AC-001: English and Spanish are both selectable in the application -> plan step implement-01 -> bolt verify-01
- AC-002: switching locale does not change canonical program hash/semantics -> plan step implement-02 -> bolt verify-02
- AC-003: First Mission is complete in both locales -> plan step implement-03 -> bolt verify-03
- AC-004: Run/Step/Stop/Reset, proposal review and execution evidence are localized -> plan step implement-04 -> bolt verify-04
- AC-005: deterministic fake Learning Companion works in both locales -> plan step implement-05 -> bolt verify-05
- AC-006: real-provider requests carry locale explicitly -> plan step implement-06 -> bolt verify-06
- AC-007: AI structured fields remain locale-independent -> plan step implement-07 -> bolt verify-07
- AC-008: safety-critical copy exists and is reviewed in both locales -> plan step implement-08 -> bolt verify-08
- AC-009: no core learner-facing UI strings are hard-coded outside localization resources -> plan step implement-09 -> bolt verify-09
- AC-010: locale fallback is deterministic and tested -> plan step implement-10 -> bolt verify-10
- AC-011: missing translation keys fail CI or produce an explicit developer diagnostic -> plan step implement-11 -> bolt verify-11
- AC-012: adding a third locale does not require changing canonical program/runtime code -> plan step implement-12 -> bolt verify-12
- AC-013: README.md and README.es.md provide equivalent product information. -> plan step implement-13 -> bolt verify-13

## Risk Register

- locale change must not require restarting the mission
- no core learner-facing UI strings are hard-coded outside localization resources
- No explicit dependency was declared.

## Risks, constraints and dependencies

- locale change must not require restarting the mission
- no core learner-facing UI strings are hard-coded outside localization resources
- No explicit dependency was declared.

## Source facts and proposed decisions

- Source issue objective: Make Agorix a **multilingual learning product** so children can use the platform, missions, feedback and AI Learning Companion in their own language without changing programming semantics or creating locale-specific forks.
- Pathway: brownfield
- Work: issue-110
- Repository languages: TypeScript, JavaScript
- Build systems: Node, pnpm
- Test files observed: 16
- Files scanned deterministically: 124
- Candidate verification commands: pnpm test
- Proposed decision: keep this deterministic draft non-authoritative until human review.

## Files created or modified

- .agora/ai-sdlc/handoffs/issue-110/DETERMINISTIC_INCEPTION.md (deterministic Inception draft only).

## Human decision required

- Approve, modify or reject this deterministic Inception proposal before Construction.
