<!-- agora-ai-sdlc:construction/v1 -->

# Implementation Plan — issue-99

1. `apps/web/src/ProvenanceLabel.tsx` + i18n keys (en/es). (done)
2. Wired into `App.tsx` at the four call sites listed in `DOMAIN-MODEL.md`. (done)
3. `apps/web/src/App.css` — badge styling (icon+text pairing, distinct backgrounds per kind, never color-only). (done)
4. `apps/web/src/ProvenanceLabel.test.tsx` — 6 unit tests. (done)
5. `apps/web/src/App.test.tsx` — 1 new test (unavailable badge on initial load). (done)
6. `apps/web/e2e/smoke.spec.ts` — 1 new Playwright test covering suggestion → accepted → runtime-fact end to end. (done)
7. AC-008 (Studio) explicitly deferred, not silently dropped. (documented)

Verified: `pnpm test` 381/381 (+7 new), full existing 24-test Playwright suite unmodified and passing, +1 new = 25/25, `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm exec eslint packages --max-warnings=0`, `node scripts/security-baseline.mjs` all pass.
