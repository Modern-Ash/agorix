<!-- agora-ai-sdlc:construction/v1 -->

# Implementation Plan — issue-36

1. `apps/web/public/manifest.webmanifest` + `apps/web/public/icons/icon.svg`. (done)
2. `apps/web/public/sw.js` — app-shell service worker. (done)
3. `apps/web/src/registerServiceWorker.ts`, wired from `main.tsx`. (done)
4. `apps/web/index.html` — link manifest, icon, theme-color/mobile-web-app meta tags. (done)
5. `apps/web/src/manifest.test.ts` — unit coverage for manifest correctness. (done)
6. `apps/web/e2e/smoke.spec.ts` — two new Playwright tests: installability (manifest + SW registration) and app-shell offline availability. (done)
7. Confirmed AC-002 through AC-009 already pass via the pre-existing, unmodified e2e suite. (done)

## Known gap, disclosed rather than hidden

Manifest icons are SVG-only (no PNG) — see `LOGICAL-DESIGN.md` for why and
the recommended follow-up if a target platform later requires PNG.
