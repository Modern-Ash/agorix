---
schema: "agora/unit-of-work/v1"
id: "issue-13-structured-validation"
intent: "issue-13"
work: "structured-validation/error-codes"
source: "https://github.com/Modern-Ash/agorix/issues/13"
---

# Unit of work: Issue #13 structured validation

## Scope

Extend `packages/program-model`'s validator (issue #12) with a stable error-code
contract and the checks issue #13 requires beyond shape validation: id
uniqueness, numeric bounds, and POC size/nesting limits.

## In scope

- `ProgramValidationErrorCode` union (11 codes, per clarification) and a `code`
  field on `ProgramValidationError`, alongside its existing `path`/`value`/
  message.
- Attach a specific code to every existing #12 rejection path (schema version,
  unknown discriminators, missing/malformed fields).
- New check: every `Script.id` and every node-level id (if any nodes gain ids
  later) is unique across the whole program, not just within one script —
  `DUPLICATE_ID`.
- New check: `move.steps`, `turn.degrees` in `[-1000, 1000]`; `repeat.count` in
  `[1, 1000]`; `numericLiteral.value` in `[-1_000_000, 1_000_000]` —
  `NUMERIC_OUT_OF_BOUNDS`.
- New check: total node count ≤ 500, nesting depth ≤ 20 — `PROGRAM_TOO_LARGE` /
  `NESTING_TOO_DEEP`.
- Table-driven positive fixtures (valid programs at/under every limit) and
  negative fixtures (one per error code) as the test suite (per issue #13's
  "Tests" section).

## Out of scope

- Runtime interpreter (issue #14) — this issue only prevents invalid programs
  from reaching it.
- Any new Statement/Expression/Trigger variant (still #12's fixed set).
- Configurable/tunable limits (e.g. via a config file) — the 500/20/bounds
  constants are fixed in code for the POC.

## Source material

- GitHub issue #13 (Validate list, Error contract, Acceptance, Tests sections).
- `packages/program-model/src/validate.ts` (issue #12) — the base being
  extended, not replaced.
- PROGRAMMING_MODEL.md invariants (already covered by #12; #13 adds the parts
  #12 explicitly deferred: ids, bounds, size/depth).

## Dependencies

Depends on issue #12 (canonical schema/validator), already merged. Issue #14
(interpreter) depends on this issue's guarantee that a validated program is
safe to execute without further defensive checks.
