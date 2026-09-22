---
schema: "agora/requirements/v1"
id: "issue-12-program-model-schema"
intent: "issue-12"
work: "program-model/schema-v1"
source: "https://github.com/Modern-Ash/agorix/issues/12"
---

# Requirements: Issue #12 canonical program schema

Each requirement maps 1:1 to one of issue #12's five acceptance checkboxes.

## R1 — Documented example is valid

The exact JSON example from `PROGRAMMING_MODEL.md` (a `repeat` containing a
`move`, under an `onStart` script) parses via `validateProgram` without error and
round-trips to an equal object.

## R2 — Every union has explicit discriminator

`Trigger`, `Statement` and `Expression` are each TypeScript discriminated unions
keyed on a `type` string-literal field; no variant is structurally ambiguous with
another (verified by a type-level exhaustiveness check in the validator's switch).

## R3 — Round-trip preserves semantic equality

For each fixture program, `JSON.parse(JSON.stringify(validateProgram(program)))`
deep-equals the original validated object.

## R4 — Future/unknown operation cannot silently enter valid model

`validateProgram` rejects: an unknown `schema` value, an unknown `type` value in
any union position, and a structurally malformed node (missing required field) —
each with a `ProgramValidationError` naming the offending path and value, not a
silent pass-through or a generic thrown error.

## R5 — Schema/version exported for persistence/migrations

`SCHEMA_VERSION` (the literal `"agorix/program/v1"`) is exported from
`packages/program-model`'s public entry point, typed as that literal, importable
by future persistence/migration code without depending on any other program-model
internals.

## R6 — No Blockly-specific fields, no executable functions in persisted form

Grep of the type definitions and validator confirms no field references Blockly
concepts (block id, workspace, XML) and no type includes a function/callback —
every field is JSON-serializable data (string, number, boolean, array, plain
object).

## Traceability

R1-R6 trace to issue #12's five acceptance checkboxes (R2 covers "every union has
explicit discriminator"; R6 covers the two schema-shape constraints from the
issue's "Requirements" section, not separately checkboxed but required). Evidence
is real Vitest output (unit + snapshot + round-trip tests, per the issue's "Tests"
section), not doc-equivalent.
