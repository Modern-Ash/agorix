# Experimental Ori runtime preview — Agorix integration/ori

The host-owned `createOriRuntimePreview` adapter starts a separate local Ori process only when explicitly enabled. It allows five pedagogical intents, forces `ORI_LOCAL_MODELS=0`, applies a timeout/output cap, validates the v1 plan envelope and returns a review-only hint and next step. It rejects malformed, unauthorized or auto-applying responses.

This is a **server-side integration seam**, not yet a registered tutor route or a browser feature. No child input or project contents are sent to Ori. The host must authorize and review any future proposal; no write API is exposed.

## Verification

- `pnpm exec vitest run apps/tutor-api/src/oriRuntimePreview.test.ts`
- `ORI_REPO_PATH=/absolute/path/to/ori pnpm test:ori:runtime`
- `pnpm lint && pnpm test && pnpm build`

## Remaining product milestone

Wire the adapter behind an explicit experimental Tutor API feature flag, expose a non-applying review-only response to the web app, then implement Playwright happy-path, disabled-mode and adversarial tests. This is not child-facing or deployed.

**Branch isolation:** only `integration/ori`; no Agorix `main` or `develop` merge.
