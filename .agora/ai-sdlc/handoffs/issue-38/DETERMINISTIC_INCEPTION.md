## Intent interpretation

Build Agorix Studio — VS Code learning and creation environment

## Material clarifications

- No material clarification detected from the explicit issue.

## Level 1 Plan

- scope: execute — lock the explicit issue objective, constraints and acceptance criteria.
- implement-01: execute — satisfy AC-001: extension builds/packages
- implement-02: execute — satisfy AC-002: opens same project semantics as Web
- implement-03: execute — satisfy AC-003: active node maps correctly to editor range
- implement-04: execute — satisfy AC-004: Step updates code + World Preview + inspector consistently
- implement-05: execute — satisfy AC-005: ProgramProposal can be inspected/rejected/applied explicitly
- implement-06: execute — satisfy AC-006: no silent mutation
- implement-07: execute — satisfy AC-007: Web-created fixture opens in Studio
- implement-08: execute — satisfy AC-008: Studio-modified canonical fixture reopens in Web via #121
- implement-09: execute — satisfy AC-009: visual language follows #117.
- verify: execute — run targeted verification and collect evidence before review.

## User Stories

- US-001 candidate: extension builds/packages
- US-002 candidate: opens same project semantics as Web
- US-003 candidate: active node maps correctly to editor range
- US-004 candidate: Step updates code + World Preview + inspector consistently
- US-005 candidate: ProgramProposal can be inspected/rejected/applied explicitly
- US-006 candidate: no silent mutation
- US-007 candidate: Web-created fixture opens in Studio
- US-008 candidate: Studio-modified canonical fixture reopens in Web via #121
- US-009 candidate: visual language follows #117.

## Non-functional requirements

- Explicit constraint/NFR candidate: no second canonical model
- Explicit constraint/NFR candidate: no duplicated runtime semantics
- Explicit constraint/NFR candidate: no provider-specific workflow
- Explicit constraint/NFR candidate: no direct LLM mutation
- Explicit constraint/NFR candidate: VS Code API imports isolated to extension/adapters
- Explicit constraint/NFR candidate: Studio may work without a remote AI provider.
- Explicit constraint/NFR candidate: no silent mutation

## Measurement Criteria

- MC-001: prove AC-001 with observable verification evidence for: extension builds/packages
- MC-002: prove AC-002 with observable verification evidence for: opens same project semantics as Web
- MC-003: prove AC-003 with observable verification evidence for: active node maps correctly to editor range
- MC-004: prove AC-004 with observable verification evidence for: Step updates code + World Preview + inspector consistently
- MC-005: prove AC-005 with observable verification evidence for: ProgramProposal can be inspected/rejected/applied explicitly
- MC-006: prove AC-006 with observable verification evidence for: no silent mutation
- MC-007: prove AC-007 with observable verification evidence for: Web-created fixture opens in Studio
- MC-008: prove AC-008 with observable verification evidence for: Studio-modified canonical fixture reopens in Web via #121
- MC-009: prove AC-009 with observable verification evidence for: visual language follows #117.

## Proposed Units

- UOW candidate: build-agorix-studio-vs-code-learning-and-creation-environment — one cohesive delivery unit for the governed issue.

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

- AC-001: extension builds/packages -> plan step implement-01 -> bolt verify-01
- AC-002: opens same project semantics as Web -> plan step implement-02 -> bolt verify-02
- AC-003: active node maps correctly to editor range -> plan step implement-03 -> bolt verify-03
- AC-004: Step updates code + World Preview + inspector consistently -> plan step implement-04 -> bolt verify-04
- AC-005: ProgramProposal can be inspected/rejected/applied explicitly -> plan step implement-05 -> bolt verify-05
- AC-006: no silent mutation -> plan step implement-06 -> bolt verify-06
- AC-007: Web-created fixture opens in Studio -> plan step implement-07 -> bolt verify-07
- AC-008: Studio-modified canonical fixture reopens in Web via #121 -> plan step implement-08 -> bolt verify-08
- AC-009: visual language follows #117. -> plan step implement-09 -> bolt verify-09

## Risk Register

- no second canonical model
- no duplicated runtime semantics
- no provider-specific workflow
- no direct LLM mutation
- VS Code API imports isolated to extension/adapters
- Studio may work without a remote AI provider.
- no silent mutation
- stable project format.

## Risks, constraints and dependencies

- no second canonical model
- no duplicated runtime semantics
- no provider-specific workflow
- no direct LLM mutation
- VS Code API imports isolated to extension/adapters
- Studio may work without a remote AI provider.
- no silent mutation
- stable project format.

## Source facts and proposed decisions

- Source issue objective: Build Agorix Studio — VS Code learning and creation environment
- Pathway: brownfield
- Work: issue-38
- Repository languages: TypeScript, JavaScript
- Build systems: Node, pnpm
- Test files observed: 16
- Files scanned deterministically: 130
- Candidate verification commands: pnpm test
- Proposed decision: keep this deterministic draft non-authoritative until human review.

## Files created or modified

- .agora/ai-sdlc/handoffs/issue-38/DETERMINISTIC_INCEPTION.md (deterministic Inception draft only).

## Human decision required

- Approve, modify or reject this deterministic Inception proposal before Construction.
