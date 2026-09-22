---
schema: "agora/unit-of-work/v1"
id: "issue-12-program-model-schema"
intent: "issue-12"
work: "program-model/schema-v1"
source: "https://github.com/Modern-Ash/agorix/issues/12"
---

# Unit of work: Issue #12 canonical program schema

## Scope

Implement `agorix/program/v1` in `packages/program-model/src`: TypeScript types,
a runtime validator, and stable-id helpers — no interpreter/execution (issue #14),
no code generation (issue #16), no Blockly mapping (issue #17).

## In scope

- Types: `ProjectProgram`, `Script`, `Trigger` (`onStart`), `Statement` (`move`,
  `turn`, `repeat`, `if`), `Expression` (`touchingGoal`, boolean literal, numeric
  literal) — each union discriminated by a `type` string-literal field.
- `SCHEMA_VERSION = "agorix/program/v1"` exported constant, typed as the literal.
- `validateProgram(input: unknown): ProjectProgram` runtime validator throwing/
  returning a typed `ProgramValidationError` on invalid input (wrong schema
  version, unknown discriminator, malformed nesting).
- Stable id conventions for `Script.id` and per-node ids (string, caller-supplied
  at construction, preserved verbatim through validation/serialization).
- The documented `PROGRAMMING_MODEL.md` example as a fixture, asserted valid.

## Out of scope

- Runtime interpreter/execution (issue #14).
- Code-generator text projection (issue #16).
- Blockly↔program-model mapping (issue #17).
- Any Statement/Expression/Trigger beyond issue #12's enumerated set.
- Persistence/migration logic itself (issue #28) — this issue only exports the
  version constant that persistence code will later consume.

## Source material

- docs/architecture/PROGRAMMING_MODEL.md — schema shape, example, invariants.
- SYSTEM_DESIGN.md — program-model package boundary (no UI/platform imports).
- AGENTS.md — deterministic tests for success and failure paths.

## Dependencies

Builds inside `packages/program-model` from issue #11's monorepo skeleton. No
other code dependency; issues #13 (validation/errors), #14 (interpreter), #16
(code-generator) build on top of this schema.
