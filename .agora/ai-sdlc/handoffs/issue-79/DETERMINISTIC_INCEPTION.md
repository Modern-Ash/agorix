## Intent interpretation

Generalize the current single textual code generator into a provider-independent, deterministic **LanguageProjection** boundary.

## Material clarifications

- No material clarification detected from the explicit issue.

## Level 1 Plan

- scope: execute — lock the explicit issue objective, constraints and acceptance criteria.
- implement-01: execute — satisfy AC-001: existing code-generator behavior can be represented by the new contract
- implement-02: execute — satisfy AC-002: node-to-text mapping is language-independent at the API level
- implement-03: execute — satisfy AC-003: unsupported canonical nodes fail explicitly
- implement-04: execute — satisfy AC-004: formatting is deterministic
- implement-05: execute — satisfy AC-005: projections can be registered/discovered without domain coupling to UI
- implement-06: execute — satisfy AC-006: tests prove two independent projection implementations can satisfy the same contract.
- verify: execute — run targeted verification and collect evidence before review.

## User Stories

- US-001 candidate: existing code-generator behavior can be represented by the new contract
- US-002 candidate: node-to-text mapping is language-independent at the API level
- US-003 candidate: unsupported canonical nodes fail explicitly
- US-004 candidate: formatting is deterministic
- US-005 candidate: projections can be registered/discovered without domain coupling to UI
- US-006 candidate: tests prove two independent projection implementations can satisfy the same contract.

## Non-functional requirements

- No explicit NFR was found in the source; enrich only if the Intent requires one.

## Measurement Criteria

- MC-001: prove AC-001 with observable verification evidence for: existing code-generator behavior can be represented by the new contract
- MC-002: prove AC-002 with observable verification evidence for: node-to-text mapping is language-independent at the API level
- MC-003: prove AC-003 with observable verification evidence for: unsupported canonical nodes fail explicitly
- MC-004: prove AC-004 with observable verification evidence for: formatting is deterministic
- MC-005: prove AC-005 with observable verification evidence for: projections can be registered/discovered without domain coupling to UI
- MC-006: prove AC-006 with observable verification evidence for: tests prove two independent projection implementations can satisfy the same contract.

## Proposed Units

- UOW candidate: define-languageprojection-contract-and-canonical-node-to-text-mapping-api — one cohesive delivery unit for the governed issue.

## Suggested Bolts

- prepare-contract: sequential — confirm scope, repository facts and deterministic acceptance trace.
- verify-01: sequential — implement and verify AC-001; depends on prior accepted scope.
- verify-02: sequential — implement and verify AC-002; depends on prior accepted scope.
- verify-03: sequential — implement and verify AC-003; depends on prior accepted scope.
- verify-04: sequential — implement and verify AC-004; depends on prior accepted scope.
- verify-05: sequential — implement and verify AC-005; depends on prior accepted scope.
- verify-06: sequential — implement and verify AC-006; depends on prior accepted scope.
- final-verification: sequential — run repository checks and collect evidence.

## Acceptance criteria trace

- AC-001: existing code-generator behavior can be represented by the new contract -> plan step implement-01 -> bolt verify-01
- AC-002: node-to-text mapping is language-independent at the API level -> plan step implement-02 -> bolt verify-02
- AC-003: unsupported canonical nodes fail explicitly -> plan step implement-03 -> bolt verify-03
- AC-004: formatting is deterministic -> plan step implement-04 -> bolt verify-04
- AC-005: projections can be registered/discovered without domain coupling to UI -> plan step implement-05 -> bolt verify-05
- AC-006: tests prove two independent projection implementations can satisfy the same contract. -> plan step implement-06 -> bolt verify-06

## Risk Register

- No explicit constraint beyond the source issue was detected.
- No explicit dependency was declared.

## Risks, constraints and dependencies

- No explicit constraint beyond the source issue was detected.
- No explicit dependency was declared.

## Source facts and proposed decisions

- Source issue objective: Generalize the current single textual code generator into a provider-independent, deterministic **LanguageProjection** boundary.
- Pathway: documentation
- Work: issue-79
- Repository languages: TypeScript, JavaScript
- Build systems: Node, pnpm
- Test files observed: 19
- Files scanned deterministically: 149
- Candidate verification commands: pnpm test
- Proposed decision: keep this deterministic draft non-authoritative until human review.

## Files created or modified

- .agora/ai-sdlc/handoffs/issue-79/DETERMINISTIC_INCEPTION.md (deterministic Inception draft only).

## Human decision required

- Approve, modify or reject this deterministic Inception proposal before Construction.
