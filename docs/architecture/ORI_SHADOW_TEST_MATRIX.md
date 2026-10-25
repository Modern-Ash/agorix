# Ori shadow integration — expanded regression test matrix

This suite is isolated to `integration/ori` and does not modify Agorix Kids, its runtime, or stable branches.

## Coverage
| Area | Cases |
|---|---|
| Contract | Valid v1, null/array, missing/wrong version, extra proposal or child identifier, invalid stage, invalid steps/hint/context, incorrect approval or applied-change flags |
| HTTP | 400, 401, 403, 404, 429, 500, 503, invalid JSON, 4096/4097/16384-byte bodies |
| Privacy | Aggregate counters only; no response text, identifiers, project data or messages |
| Concurrency | Limits 1/2/4/8, excess requests dropped without queuing, capacity recovery |
| Resilience | Disabled feature, synchronous and asynchronous callback failure, network failure, abort/timeout |
| Existing behavior | Shadow result cannot modify deterministic tutor response |

## Verification
Run from the Agorix repository:

```bash
pnpm exec vitest run apps/tutor-api/src/oriShadowMetrics.test.ts apps/tutor-api/src/oriShadowMetrics.extended.test.ts apps/tutor-api/src/oriShadowResilience.extended.test.ts
pnpm format:check
pnpm lint
pnpm test
pnpm build
```

The cross-repository process test remains separate:

```bash
ORI_REPO_PATH=/absolute/path/to/ori pnpm test:ori:interop
```

Do not claim live interoperability from ordinary CI when `ORI_REPO_PATH` is absent. Preserve the actual test output and commit SHAs.

## Release gates
- All regression tests and format/type checks green.
- No child data or model output in telemetry.
- No effect on Kids when Ori is offline, slow or invalid.
- Shadow remains disabled by default.
- Human review before merging into `integration/ori`.
- Explicit separate approval before any promotion to `main` or `development`.

These are engineering checks, not proof of pedagogical effectiveness or complete child-safety certification.
