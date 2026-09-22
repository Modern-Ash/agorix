---
schema: "agora/test-strategy/v1"
id: "issue-12-program-model-schema"
work: "program-model/schema-v1"
---

# Test strategy: program-model schema

Real code, real tests — every row is a command that was actually run.

## Checklist (= test suite)

| Check | Requirement | Command / method | Result |
| --- | --- | --- | --- |
| Documented example (typed) validates | R1 | `validate.test.ts` "accepts the documented example program" | pass |
| Documented example (raw JSON) validates | R1 | `validate.test.ts` "accepts the documented example as raw JSON" | pass |
| Every union discriminated on `type` | R2 | `schema.ts` type review + `validate.ts` switch coverage per union | pass |
| Round-trip preserves semantic equality | R3 | `validate.test.ts` "round-trips through JSON without semantic drift" (both fixtures) | pass |
| Unknown schema version rejected | R4 | `validate.test.ts` "rejects an unknown schema version" | pass |
| Unknown statement/expression/trigger type rejected, path named | R4 | `validate.test.ts` 3 rejection tests + path assertion | pass |
| Malformed nesting (missing field) rejected | R4 | `validate.test.ts` "rejects a statement missing a required field" | pass |
| `SCHEMA_VERSION` exported from package entry point | R5 | `index.test.ts` "exports the schema version as the documented literal" | pass |
| No Blockly references, no functions in schema | R6 | `grep -riE "blockly"` and `grep -E "=>"` over `schema.ts` — 0 matches | pass |
| Deterministic serialization | (invariant) | `serialization.test.ts` snapshot tests (2 snapshots written) | pass |
| Full toolchain green | (R2 from #11, re-verified) | `pnpm lint` (0 errors), `pnpm test` (34/34), `pnpm build` (12/12 incl. `apps/web` importing this package) | pass |

11 of 11 checks pass, covering R1-R6 plus the schema's structural invariants.

## Result

success — 34/34 Vitest tests pass workspace-wide (up from 21 after issue #11;
`program-model` alone now contributes 2 identity tests, 9 `validateProgram`
tests and 2 serialization snapshots), 0 lint errors, 12/12 workspace builds
succeed, 0 regressions in the other 8 packages/3 apps from issue #11's
skeleton.
