---
schema: "agora/requirements/v1"
id: "issue-13-structured-validation"
intent: "issue-13"
work: "structured-validation/error-codes"
source: "https://github.com/Modern-Ash/agorix/issues/13"
---

# Requirements: Issue #13 structured validation

Each requirement maps to one of issue #13's acceptance checkboxes or its
"Error contract" section.

## R1 — Valid fixtures pass

`DOCUMENTED_EXAMPLE_PROGRAM` and `FULL_COVERAGE_PROGRAM` (from issue #12) still
validate under the extended validator with no new false-positive rejections.

## R2 — Unknown schema fails explicitly

An unrecognized `schema` value throws `ProgramValidationError` with code
`INVALID_SCHEMA_VERSION` (already true from #12; #13 attaches the stable code).

## R3 — Duplicate ids fail

Two scripts sharing the same `id` (anywhere in the program, not just adjacent)
throw with code `DUPLICATE_ID`, naming both paths where the id occurs.

## R4 — Unsupported operation fails

An unknown `type` discriminator in any Trigger/Statement/Expression position
throws with `UNKNOWN_TRIGGER_TYPE` / `UNKNOWN_STATEMENT_TYPE` /
`UNKNOWN_EXPRESSION_TYPE` respectively (already true from #12; #13 attaches the
stable code).

## R5 — Excessive size/depth fails

A program with more than 500 total statement+expression nodes throws
`PROGRAM_TOO_LARGE`; a program nesting `repeat`/`if` more than 20 levels deep
throws `NESTING_TOO_DEEP`.

## R6 — No partial execution after validation failure

`validateProgram` either returns a fully-validated `ProjectProgram` or throws —
there is no code path that returns a partially-checked value, and no caller in
this codebase (yet — the interpreter doesn't exist until #14) can obtain an
unvalidated program from this function.

## R7 — Stable error contract

Every `ProgramValidationError` has: a `code` (one of the 11 literals), a `path`
(unchanged from #12), and a message safe to show a developer (no raw user data
beyond the already-untrusted input value, no stack-trace-only information).
Numeric-bounds violations additionally use `NUMERIC_OUT_OF_BOUNDS`.

## Traceability

R1-R7 trace to issue #13's 5 acceptance checkboxes plus its "Error contract"
section (R7) and its "no partial execution" phrasing (R6). Evidence is
table-driven Vitest tests (positive + one negative case per code), matching
the issue's "Tests" section ("table-driven positive and negative cases").
