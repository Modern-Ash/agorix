---
schema: "agora/implementation-plan/v1"
id: "issue-12-program-model-schema"
work: "program-model/schema-v1"
---

# Implementation plan: program-model schema

1. Re-read PROGRAMMING_MODEL.md's exact JSON example and invariants.
2. Write `schema.ts`: `SCHEMA_VERSION` constant + `ProjectProgram`/`Script`/
   `Trigger`/`Statement`/`Expression` discriminated unions, `type` as the
   discriminator (clarified decision), matching the doc's field names exactly
   (`steps`, `degrees`, `count`, `body`, `condition`, `then`, `value`).
   2b. Kept every field `readonly` and every array `readonly T[]` — persisted
   program data should not be mutated in place by callers (supports the "no
   executable functions / pure data" invariant in spirit, not just field type).
3. Write `validate.ts`: `ProgramValidationError` (path + value), a
   `validateProgram(input: unknown): ProjectProgram` entry point, and one
   `validate*` helper per union type, each ending in an exhaustive-by-convention
   `switch`/`default: fail(...)`.
4. Write `fixtures.ts`: the documented example verbatim, plus a full-coverage
   fixture exercising all 8 leaf variants at least once.
5. Write `validate.test.ts`: acceptance (documented example, both as a typed
   object and as raw parsed JSON) + 6 rejection cases (bad schema version,
   unknown statement/expression/trigger type, missing required field, and
   non-object input) — asserting both that it throws and, for one case, the
   exact error `path`.
6. Write `serialization.test.ts`: snapshot the deterministic JSON serialization
   of both fixtures.
7. Update `index.ts` to export the new public surface (types, `SCHEMA_VERSION`,
   `validateProgram`, `ProgramValidationError`), replacing issue #11's
   placeholder while keeping `PACKAGE_NAME` (still used by `apps/web`).
8. Run `pnpm test` (34/34 passed, 2 snapshots written), `pnpm lint` (0 errors),
   `pnpm build` (all 12 projects, including `apps/web` which imports this
   package) as real evidence, not inspection alone.
9. Grep `schema.ts` for "blockly" and arrow-function syntax — 0 matches (R6).

Executed by `project:ai-runtime-2` (developer) in this session. No defects found
in this cycle (unlike #11) — the monorepo toolchain from #11 caught type errors
immediately during development rather than at a separate verification step.
