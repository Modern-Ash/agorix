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
