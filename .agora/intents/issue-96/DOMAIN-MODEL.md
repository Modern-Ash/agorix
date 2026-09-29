<!-- agora-ai-sdlc:construction/v1 -->

# Domain Model — issue-96 (provider selection, fallback, offline mode)

## New module

`packages/provider-runtime/src/selection.ts`, re-exported from the package's
`index.ts`:

- `selectProviderRuntime(runtimes, health, config)` — pure, synchronous
  ordered-fallback selection by capability + precomputed health.
- `checkProviderRuntimeHealth(runtimes)` — async probe building the health
  map `selectProviderRuntime` consumes; a throwing `health()` counts as
  `"unavailable"`.
- `describeProviderUnavailableForLearner(reason, locale)` — child-facing,
  jargon-free copy for an unavailable outcome (en/es).

## Reused as-is

- `LearningCompanionProviderRuntime`, `negotiateCapability`,
  `ProviderRuntimeDescriptor`, `ProviderRuntimeHealthStatus` from
  `@agorix/provider-runtime`'s existing `index.ts` (issues #92/#93/#94) —
  unchanged.

## Design note: why selection is synchronous over a precomputed health map

Mixing live async health probing into the selection function itself would
make table-driven testing require mocking `fetch`/timers per case. Splitting
health probing (`checkProviderRuntimeHealth`, async, I/O) from selection
(`selectProviderRuntime`, pure, sync) keeps the fallback/offline logic
itself trivially unit-testable and keeps "offline mode never calls the
network" true by construction: `offline: true` returns before any runtime
lookup happens.
