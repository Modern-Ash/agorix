---
schema: "agora/domain-model/v1"
id: "issue-12-program-model-schema"
work: "program-model/schema-v1"
---

# Domain model: agorix/program/v1

## Entities

- **ProjectProgram**: root document — `schema` (literal `"agorix/program/v1"`) +
  `scripts: Script[]`.
- **Script**: `id` (stable, caller-supplied) + `trigger: Trigger` + `statements:
  Statement[]`.
- **Trigger**: discriminated union, v1 has one variant — `onStart`.
- **Statement**: discriminated union — `move`, `turn`, `repeat` (recursive: `body:
  Statement[]`), `if` (recursive: `condition: Expression`, `then: Statement[]`).
- **Expression**: discriminated union — `touchingGoal`, `booleanLiteral`,
  `numericLiteral`.
- **ProgramValidationError**: thrown by `validateProgram`, carries `path` (e.g.
  `$.scripts[0].statements[1].type`) and the offending `value`.

## Relationships

- `ProjectProgram` 1—* `Script` 1—1 `Trigger`, 1—* `Statement`.
- `RepeatStatement.body` and `IfStatement.then` → `Statement[]` (recursive
  containment — a program is a tree, not a flat list).
- `IfStatement.condition` → `Expression` (any variant; the schema does not
  restrict which literal type can act as a condition at the type level — runtime
  semantics are the interpreter's concern, issue #14).
- All 8 leaf types (`move`, `turn`, `repeat`, `if`, `touchingGoal`,
  `booleanLiteral`, `numericLiteral`, `onStart`) are pure data — no function or
  callback field exists anywhere in the schema (R6).

## Invariants enforced

- Discriminator (`type`) is exhaustively switched in `validate.ts`; the
  `default` branch of every switch calls `fail(...)`, so a 9th future variant is
  rejected, not silently coerced (R4).
- `SCHEMA_VERSION` is the single source of truth for the version literal; both
  the type (`SchemaVersion`) and the validator check against it, so they cannot
  drift apart.
