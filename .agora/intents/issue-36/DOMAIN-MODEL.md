<!-- agora-ai-sdlc:construction/v1 -->

# Domain Model — issue-36 (tablet-first installable Web/PWA)

## New files

- `apps/web/public/manifest.webmanifest` — web app manifest (name, icons, `display: standalone`, theme/background color).
- `apps/web/public/icons/icon.svg` — app icon (`any` and `maskable` purpose).
- `apps/web/public/sw.js` — app-shell service worker: precaches the shell on install, network-first with cache fallback for same-origin GETs, deletes stale caches on activate.
- `apps/web/src/registerServiceWorker.ts` — registers `sw.js` after `window.load`; no-ops where `serviceWorker` is unsupported (e.g. Vitest/jsdom) and swallows registration failure.
- `apps/web/src/manifest.test.ts` — unit tests asserting the manifest satisfies Chromium's installability minimum fields and icon requirements.

## Reused as-is (AC-002 through AC-009)

All other acceptance criteria were already satisfied by the existing `apps/web/e2e/smoke.spec.ts` suite (touch-only mission completion, portrait/landscape code visibility, World+Code layout, touch-safe AI proposal journey, Step trace visibility, locale switching, tablet viewport coverage) — confirmed by running the full suite unmodified before adding new code.
