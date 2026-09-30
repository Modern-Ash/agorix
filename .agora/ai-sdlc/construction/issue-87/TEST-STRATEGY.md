<!-- agora-ai-sdlc:deterministic-construction/v1 -->

# Test Strategy

This proposal is derived only from already approved Inception artifacts.
It is non-authoritative implementation guidance; Agora Flow retains the governed source artifacts below.

## Measurement Criteria

# Measurement criteria — issue #87

Derived from DETERMINISTIC_INCEPTION.md (deterministic draft, pending human review).

- MC-001: prove AC-001 with observable verification evidence for: stale proposal cannot apply to changed base
- MC-002: prove AC-002 with observable verification evidence for: unknown operation rejected
- MC-003: prove AC-003 with observable verification evidence for: resulting program must validate
- MC-004: prove AC-004 with observable verification evidence for: deterministic diff generated independently from model prose
- MC-005: prove AC-005 with observable verification evidence for: proposal can be serialized/audited without PII
- MC-006: prove AC-006 with observable verification evidence for: no provider SDK types leak into protocol
- MC-007: prove AC-007 with observable verification evidence for: tests cover insert/change/remove/stale/invalid
- MC-008: prove AC-008 with observable verification evidence for: integrates with UI boundary from #75.

## User Stories / Acceptance

# User stories — issue #87

Derived from DETERMINISTIC_INCEPTION.md (deterministic draft, pending human review).

- US-001 candidate: stale proposal cannot apply to changed base
- US-002 candidate: unknown operation rejected
- US-003 candidate: resulting program must validate
- US-004 candidate: deterministic diff generated independently from model prose
- US-005 candidate: proposal can be serialized/audited without PII
- US-006 candidate: no provider SDK types leak into protocol
- US-007 candidate: tests cover insert/change/remove/stale/invalid
- US-008 candidate: integrates with UI boundary from #75.

## NFR

# Non-functional requirements — issue #87

Derived from DETERMINISTIC_INCEPTION.md (deterministic draft, pending human review).

- Explicit constraint/NFR candidate: no executable arbitrary code payload as authority.
- Explicit constraint/NFR candidate: no provider SDK types leak into protocol
