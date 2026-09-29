<!-- agora-ai-sdlc:construction/v1 -->

# Implementation Plan — issue-103

1. Explored actual data flow before writing anything: `apps/tutor-api/src/index.ts`, `packages/provider-runtime/src/index.ts`, `packages/persistence/src/store.ts`, `apps/web/src/*.tsx` (no free-text input exists in the shipped UI), repo-wide grep for `console.*` in first-party source. (done)
2. `docs/safety/PRIVACY_THREAT_MODEL.md` — full threat model doc. (done)
3. `scripts/security-baseline.mjs` + `scripts/security-baseline.test.mjs` — new `no-learner-free-text-logging` rule + 6 tests. (done)
4. `docs/safety/CHILD_SAFETY_PRIVACY.md` + `docs/safety/WEB_SECURITY_BASELINE.md` — cross-links. (done)

Verified: `pnpm test` 386/386 (+6 new), `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm exec eslint packages --max-warnings=0`, `node scripts/security-baseline.mjs` all pass.
