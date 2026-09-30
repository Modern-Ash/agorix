<!-- agora-ai-sdlc:deterministic-construction/v1 -->

# Logical Design

This proposal is derived only from already approved Inception artifacts.
It is non-authoritative implementation guidance; Agora Flow retains the governed source artifacts below.

## Level 1 Plan

# Level 1 Plan — issue #87

Derived from DETERMINISTIC_INCEPTION.md (deterministic draft, pending human review).

- scope: execute — lock the explicit issue objective, constraints and acceptance criteria.
- implement-01: execute — satisfy AC-001: stale proposal cannot apply to changed base
- implement-02: execute — satisfy AC-002: unknown operation rejected
- implement-03: execute — satisfy AC-003: resulting program must validate
- implement-04: execute — satisfy AC-004: deterministic diff generated independently from model prose
- implement-05: execute — satisfy AC-005: proposal can be serialized/audited without PII
- implement-06: execute — satisfy AC-006: no provider SDK types leak into protocol
- implement-07: execute — satisfy AC-007: tests cover insert/change/remove/stale/invalid
- implement-08: execute — satisfy AC-008: integrates with UI boundary from #75.
- verify: execute — run targeted verification and collect evidence before review.

- AC-001: stale proposal cannot apply to changed base -> plan step implement-01 -> bolt verify-01
- AC-002: unknown operation rejected -> plan step implement-02 -> bolt verify-02
- AC-003: resulting program must validate -> plan step implement-03 -> bolt verify-03
- AC-004: deterministic diff generated independently from model prose -> plan step implement-04 -> bolt verify-04
- AC-005: proposal can be serialized/audited without PII -> plan step implement-05 -> bolt verify-05
- AC-006: no provider SDK types leak into protocol -> plan step implement-06 -> bolt verify-06
- AC-007: tests cover insert/change/remove/stale/invalid -> plan step implement-07 -> bolt verify-07
- AC-008: integrates with UI boundary from #75. -> plan step implement-08 -> bolt verify-08

## NFR

# Non-functional requirements — issue #87

Derived from DETERMINISTIC_INCEPTION.md (deterministic draft, pending human review).

- Explicit constraint/NFR candidate: no executable arbitrary code payload as authority.
- Explicit constraint/NFR candidate: no provider SDK types leak into protocol

## Unit of Work

<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Deterministic Unit of Work

- Work: issue-87
- Pathway: brownfield

## Objective

Create the domain protocol used whenever AI proposes a program change.

## Scope

- Deliver the explicit source-issue objective within the governed Work.
- Preserve the source constraints and acceptance criteria without widening scope.

## Acceptance criteria

- stale proposal cannot apply to changed base
- unknown operation rejected
- resulting program must validate
- deterministic diff generated independently from model prose
- proposal can be serialized/audited without PII
- no provider SDK types leak into protocol
- tests cover insert/change/remove/stale/invalid
- integrates with UI boundary from #75.

## Constraints

- no executable arbitrary code payload as authority.
- no provider SDK types leak into protocol

## Dependencies

- No explicit dependencies.
