<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Level 1 Plan — issue-36

- scope: execute — lock the explicit issue objective, constraints and acceptance criteria.
- implement-01: execute — satisfy AC-001: PWA installability requirements pass
- implement-02: execute — satisfy AC-002: First Mission works touch-only
- implement-03: execute — satisfy AC-003: code remains inspectable in portrait and landscape
- implement-04: execute — satisfy AC-004: World + Code dominate layout
- implement-05: execute — satisfy AC-005: AI proposal flow is usable by touch
- implement-06: execute — satisfy AC-006: Step execution remains visible
- implement-07: execute — satisfy AC-007: locale switching from #110 works
- implement-08: execute — satisfy AC-008: offline/provider-unavailable behavior follows #96
- implement-09: execute — satisfy AC-009: Playwright covers tablet portrait and landscape.
- verify: execute — run targeted verification and collect evidence before review.

## Acceptance criteria trace

- AC-001: PWA installability requirements pass -> plan step implement-01 -> bolt verify-01 (new: manifest.webmanifest, sw.js, registerServiceWorker.ts)
- AC-002 through AC-007, AC-009: already satisfied by the pre-existing `apps/web/e2e/smoke.spec.ts` suite (touch/no-drag mission completion, portrait/landscape code visibility, World+Code layout, transparency/proposal touch journeys, Step trace visibility, locale switch, tablet viewport coverage) — verified unmodified.
- AC-008: already satisfied by the pre-existing "offline tutor hints escalate without changing blocks" test (the deterministic tutor path never calls the network); issue #96's `selectProviderRuntime` offline mode is a library-level guarantee consumed by any future live-provider wiring.
