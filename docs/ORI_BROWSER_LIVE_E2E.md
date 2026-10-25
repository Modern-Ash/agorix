# Ori live browser integration (experimental)

This test connects the Agorix browser, compiled Tutor API and separately checked-out Ori CLI runtime. It uses synthetic metadata and deterministic hints only; no real LLM, child data or project mutation.

Run from Agorix on `integration/ori` or a branch based on it:

```bash
pnpm --filter @agorix/tutor-api build
VITE_ORI_EXPERIMENTAL_REVIEW=1 pnpm --filter @agorix/web build
ORI_REPO_PATH=/absolute/path/to/ori VITE_ORI_EXPERIMENTAL_REVIEW=1 pnpm --filter @agorix/web test:e2e -- ori-live-runtime.spec.ts
```

The test launches a disposable local Tutor API and forwards the browser's request to that API. It verifies the review-only response in the browser. This is not proof of production readiness, OS isolation or educational efficacy. The test skips unless the explicit flag, Ori checkout and Tutor API build are present; skipped tests must not count as live E2E success.

Before merge run `pnpm exec tsc --noEmit`, `pnpm format:check`, `pnpm lint`, and the opt-in Playwright suite. Do not promote to Agorix `main` or `develop`.
