<!-- agora-ai-sdlc:construction/v1 -->

# Implementation Plan — issue-96 (provider selection, fallback, offline mode)

1. `packages/provider-runtime/src/selection.ts` — `selectProviderRuntime`,
   `checkProviderRuntimeHealth`, `describeProviderUnavailableForLearner`.
   (done, tested)
2. Re-export from `packages/provider-runtime/src/index.ts`. (done)
3. `docs/architecture/adr/0005-provider-runtime-contract.md` — addendum
   documenting the selection/offline design decision. (done)
4. Table-driven unit tests covering AC-001 through AC-006; developer
   diagnostics (AC-007) are covered by the existing `ProviderRuntimeDiagnostics`
   shape, reused unchanged on the `selected` outcome. (done, 18 new tests)

## Explicit scope decision (confirmed with the human product owner)

Wiring `apps/web`'s tutor/hint button to `selectProviderRuntime` with a real
multi-provider configuration is deferred to a follow-up issue rather than
folded in here — see `LOGICAL-DESIGN.md`'s scope note. The shipped POC's
existing offline-first tutor path (`createDeterministicTutorResponse`,
pre-#85/#92) already satisfies AC-004/AC-005 for the current UI, and is
unchanged by this PR.
