---
schema: "agora/test-strategy/v1"
id: "issue-16-text-projection"
work: "text-projection/text-projection"
---

# Test strategy: text projection

Real code, real tests — every row is a command/method that is actually run.

## Checklist (= test suite)

| Check | Criterion | Command / method | Expected |
| --- | --- | --- | --- |
| Documented example projects to exact educational text | stable-snapshots, all-ops | `project.test.ts` snapshot of `projectProgram(DOCUMENTED_EXAMPLE)` | pass |
| Full-coverage fixture (onStart, move, turn, repeat, if, touchingGoal, bool/num literals) | all-ops | `project.test.ts` full-coverage assertions | pass |
| Nested repeat/if structure emits correct indentation & mapping paths | all-ops, node-text-mapping | nested fixture test | pass |
| Same program twice ⇒ byte-identical `code` and deep-equal `mapping` | deterministic | double-project equality | pass |
| Every mapping range within `[0, code.length]`, `start ≤ end` | node-text-mapping | range bounds property-style loop | pass |
| `code.slice(start,end)` equals expected snippet for nested nodes | node-text-mapping | targeted slice assertions | pass |
| Unknown statement/expression/trigger type throws `UnsupportedNodeError` with `nodeId`/`nodeType` | unsupported-error | three cast-through-unknown cases | pass |
| Input program not mutated | deterministic (purity) | structural compare before/after | pass |
| Empty `if.then` / empty statements still produce well-formed `code` | all-ops | edge fixtures | pass |
| Workspace toolchain green | all criteria (evidence) | `pnpm lint` (0 errors), `pnpm test`, `pnpm build` | pass |

## Result

Recorded as `test-suite` evidence on the work item after the suite runs
(`agora evidence add --type test-suite --result success`).
