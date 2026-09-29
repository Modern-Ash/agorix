## Intent interpretation

Make it obvious to the learner when content comes from AI, when it is only a suggestion, and when execution has actually verified behavior.

## Material clarifications

- No material clarification detected from the explicit issue.

## Level 1 Plan

- scope: execute — lock the explicit issue objective, constraints and acceptance criteria.
- implement-01: execute — satisfy AC-001: learner can tell whether a change is proposed vs already applied
- implement-02: execute — satisfy AC-002: learner can tell whether a statement is runtime evidence vs AI suggestion
- implement-03: execute — satisfy AC-003: “AI may be wrong” is communicated without excessive friction
- implement-04: execute — satisfy AC-004: status does not rely on color alone
- implement-05: execute — satisfy AC-005: screen-reader labels preserve distinction
- implement-06: execute — satisfy AC-006: provider identity is optional developer detail, not child-facing authority.
- implement-07: execute — satisfy AC-007: tablet proposal state is understandable without technical terminology
- implement-08: execute — satisfy AC-008: Studio can expose optional details
- implement-09: execute — satisfy AC-009: both surfaces preserve the same suggestion-vs-fact distinction.
- verify: execute — run targeted verification and collect evidence before review.

## User Stories

- US-001 candidate: learner can tell whether a change is proposed vs already applied
- US-002 candidate: learner can tell whether a statement is runtime evidence vs AI suggestion
- US-003 candidate: “AI may be wrong” is communicated without excessive friction
- US-004 candidate: status does not rely on color alone
- US-005 candidate: screen-reader labels preserve distinction
- US-006 candidate: provider identity is optional developer detail, not child-facing authority.
- US-007 candidate: tablet proposal state is understandable without technical terminology
- US-008 candidate: Studio can expose optional details
- US-009 candidate: both surfaces preserve the same suggestion-vs-fact distinction.

## Non-functional requirements

- No explicit NFR was found in the source; enrich only if the Intent requires one.

## Measurement Criteria

- MC-001: prove AC-001 with observable verification evidence for: learner can tell whether a change is proposed vs already applied
- MC-002: prove AC-002 with observable verification evidence for: learner can tell whether a statement is runtime evidence vs AI suggestion
- MC-003: prove AC-003 with observable verification evidence for: “AI may be wrong” is communicated without excessive friction
- MC-004: prove AC-004 with observable verification evidence for: status does not rely on color alone
- MC-005: prove AC-005 with observable verification evidence for: screen-reader labels preserve distinction
- MC-006: prove AC-006 with observable verification evidence for: provider identity is optional developer detail, not child-facing authority.
- MC-007: prove AC-007 with observable verification evidence for: tablet proposal state is understandable without technical terminology
- MC-008: prove AC-008 with observable verification evidence for: Studio can expose optional details
- MC-009: prove AC-009 with observable verification evidence for: both surfaces preserve the same suggestion-vs-fact distinction.

## Proposed Units

- UOW candidate: design-child-facing-ai-provenance-uncertainty-and-suggestion-state-ux — one cohesive delivery unit for the governed issue.

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

- AC-001: learner can tell whether a change is proposed vs already applied -> plan step implement-01 -> bolt verify-01
- AC-002: learner can tell whether a statement is runtime evidence vs AI suggestion -> plan step implement-02 -> bolt verify-02
- AC-003: “AI may be wrong” is communicated without excessive friction -> plan step implement-03 -> bolt verify-03
- AC-004: status does not rely on color alone -> plan step implement-04 -> bolt verify-04
- AC-005: screen-reader labels preserve distinction -> plan step implement-05 -> bolt verify-05
- AC-006: provider identity is optional developer detail, not child-facing authority. -> plan step implement-06 -> bolt verify-06
- AC-007: tablet proposal state is understandable without technical terminology -> plan step implement-07 -> bolt verify-07
- AC-008: Studio can expose optional details -> plan step implement-08 -> bolt verify-08
- AC-009: both surfaces preserve the same suggestion-vs-fact distinction. -> plan step implement-09 -> bolt verify-09

## Risk Register

- No explicit constraint beyond the source issue was detected.
- No explicit dependency was declared.

## Risks, constraints and dependencies

- No explicit constraint beyond the source issue was detected.
- No explicit dependency was declared.

## Source facts and proposed decisions

- Source issue objective: Make it obvious to the learner when content comes from AI, when it is only a suggestion, and when execution has actually verified behavior.
- Pathway: brownfield
- Work: issue-99
- Repository languages: TypeScript, JavaScript
- Build systems: Node, pnpm
- Test files observed: 28
- Files scanned deterministically: 189
- Candidate verification commands: pnpm test
- Proposed decision: keep this deterministic draft non-authoritative until human review.

## Files created or modified

- .agora/ai-sdlc/handoffs/issue-99/DETERMINISTIC_INCEPTION.md (deterministic Inception draft only).

## Human decision required

- Approve, modify or reject this deterministic Inception proposal before Construction.
