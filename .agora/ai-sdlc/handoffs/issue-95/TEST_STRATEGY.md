# Issue 95 Test Strategy

Scope: the server-side tutor boundary (`apps/tutor-api`) introduced by issue 95.
Domain packages, visual blocks and the canonical program model are unchanged, so
the strategy is bounded to the adapter configuration surface, the provider-runtime
delegation and the credential-free default path.

## Verification commands

Run from the repository root: Vitest resolves the root workspace `projects`
globs relative to the working directory, so a per-package `pnpm --filter` run
fails with `No projects were found` regardless of the code under test.

| Purpose | Command |
| --- | --- |
| Targeted test target | `pnpm vitest run apps/tutor-api` |
| Repository test suite | `pnpm test` |
| Typecheck | `pnpm -r --if-present run typecheck` |
| Lint | `pnpm lint` |

No provider credential is present in the environment. The default path must pass
with `AGORIX_TUTOR_ADAPTER` unset; the commercial path is exercised only through
an injected `fetch`.

## Covered paths

`apps/tutor-api/src/index.test.ts`, 14 cases in two groups.

### Adapter surface (`tutor-api server boundary`)

| Case | Assertion class |
| --- | --- |
| describes the server-side adapter surface | contract |
| defaults to the deterministic adapter with no commercial endpoint or model | success |
| reads provider, model, base URL, auth, timeout and capabilities from the environment | success |
| accepts the legacy provider, endpoint and api key variables | success |
| rejects unknown adapters and unknown capabilities | failure |

### Delegation to provider-runtime (`tutor-api delegation to provider-runtime`)

| Case | Assertion class |
| --- | --- |
| sends the mapped request to the configured compatible gateway | success |
| keeps learner free text out of provider context unless it is opted in | privacy |
| keeps the secret out of diagnostics on success and on failure | failure |
| degrades to the deterministic response when the remote adapter is not configured | failure |
| normalizes gateway failures into provider-neutral error codes | failure |
| makes an outage observably equivalent to the deterministic local adapter | failure |
| normalizes a slow gateway into a timeout without leaking provider text | failure |
| passes the deterministic adapter through the shared conformance harness | success |
| delegates capability negotiation to provider-runtime | success |

## Invariants asserted

1. Default is credential-free: no adapter, base URL, model or token is resolved
   when the environment is unset.
2. Determinism: the `fake` adapter and the degraded remote path produce the same
   learner-visible shape, so an outage is observably equivalent to local mode.
3. Child privacy: learner free text leaves the process only under
   `AGORIX_TUTOR_INCLUDE_LEARNER_QUESTION=1`.
4. Secret hygiene: the auth token appears in no diagnostic, error, fixture or log.
5. Provider neutrality: failures surface `ProviderRuntimeErrorCode`, never a
   vendor-specific vocabulary.

## Out of scope

No browser, Blockly or Capacitor test is added; no domain package changed. Visual
blocks, generated text and the Learning Companion UI are untouched by this issue.
