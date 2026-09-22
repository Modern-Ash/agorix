---
schema: "agora/architecture/v1"
id: "issue-12-program-model-schema"
work: "program-model/schema-v1"
---

# Architecture: program-model schema placement

## Files (as built)

```
packages/program-model/src/
  schema.ts               Types: ProjectProgram, Script, Trigger, Statement, Expression, SCHEMA_VERSION
  validate.ts              validateProgram(), ProgramValidationError
  fixtures.ts               DOCUMENTED_EXAMPLE_PROGRAM, FULL_COVERAGE_PROGRAM (shared by tests)
  index.ts                 Public entry point — re-exports the above
  index.test.ts             Package-identity + SCHEMA_VERSION unit tests
  validate.test.ts           Unit tests: acceptance + 6 rejection cases (R1, R4)
  serialization.test.ts       Snapshot tests (deterministic serialization)
```

## Consumption

- **Issue #13 (validation/structured errors)**: extends `ProgramValidationError`
  usage; this issue's `path`+`value` shape is the base contract, not to be
  redesigned.
- **Issue #14 (interpreter)**: consumes `ProjectProgram`/`Statement`/`Expression`
  types directly; the interpreter switches on the same `type` discriminators.
- **Issue #16 (code-generator)**: projects `ProjectProgram` into text; must not
  reach into `validate.ts` internals, only the exported types.
- **Issue #17 (Blockly adapter)**: produces `ProjectProgram` values (via
  `validateProgram` on its output) — `block-editor` depends on `program-model`,
  never the reverse (SYSTEM_DESIGN.md dependency direction).
- **Issue #28 (persistence)**: imports `SCHEMA_VERSION` to tag saved documents and
  detect version mismatches (PROGRAMMING_MODEL.md "unknown schema version fails
  explicitly").

## Change boundary

Adding a 9th Statement/Expression variant (post-#12 scope) is a change to
`schema.ts`'s union + a new `case` in `validate.ts`'s switch — the compiler's
exhaustiveness would flag any switch left unhandled if a `never`-check is added
later (deferred; not required for v1's fixed scope).
