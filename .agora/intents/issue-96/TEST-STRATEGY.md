<!-- agora-ai-sdlc:construction/v1 -->

# Test Strategy — issue-96

## Unit (Vitest, `packages/provider-runtime/src/selection.test.ts`)

Table-driven `selectProviderRuntime` cases (AC-001, AC-002, AC-003):
preferred available; preferred unavailable → fallback selected; preferred
capability-unsupported → skipped; no runtime capable →
`no-compatible-provider`; all capable runtimes unavailable →
`all-unavailable`; degraded (not unavailable) health still selects;
`offline: true` → always `offline-mode` regardless of healthy runtimes
(AC-004); `allowRemote: false` excludes remote runtimes; a `preferredOrder`
id absent from `runtimes` is skipped, not an error; empty `preferredOrder`
throws (selection must be explicit).

`checkProviderRuntimeHealth`: maps each runtime's real `health()` result;
a throwing `health()` is treated as `unavailable` rather than rejecting.

`describeProviderUnavailableForLearner`: asserts no `runtime`/`provider`/
vendor-name substring appears in the copy (AC-006), asserts the
deterministic-runtime reassurance is present for every reason, and covers
en/es plus an unrecognized-locale fallback.

Result: 371/371 passing repository-wide (`pnpm test`), including the
pre-existing 353.

## Why no browser/E2E test was added here

AC-004 ("offline mode does not call network") and AC-005 ("canonical/
runtime behavior unchanged") are proven at the unit level: selection never
constructs a request when offline, and no code path in `apps/web` was
changed (see `LOGICAL-DESIGN.md`'s scope note — UI wiring to a live
multi-provider configuration is deferred). The existing
`apps/web/e2e/smoke.spec.ts` "offline tutor hints escalate without changing
blocks" test already covers the shipped UI's offline-first behavior via the
pre-existing deterministic tutor path and continues to pass unmodified.
