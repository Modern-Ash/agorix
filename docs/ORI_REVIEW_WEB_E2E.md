# Ori review-only web journey (integration/ori)

This experimental slice mounts the Ori review panel in Agorix's companion area behind a **build-time flag**. It is not part of stable Agorix releases and does not apply project edits.

## Operator setup

From Agorix's `integration/ori` checkout, with Ori checked out separately:

```bash
# Build the experimental web variant explicitly
VITE_ORI_EXPERIMENTAL_REVIEW=1 pnpm --filter @agorix/web build

# Run Tutor API with the separately checked-out Ori runtime
AGORIX_ORI_RUNTIME_PREVIEW=1 ORI_REPO_PATH=/absolute/path/to/ori pnpm --filter @agorix/tutor-api start

# Browser tests against an experimental build
VITE_ORI_EXPERIMENTAL_REVIEW=1 pnpm --filter @agorix/web test:e2e -- ori-review.spec.ts
```

The normal web build omits the panel. The server route remains disabled unless `AGORIX_ORI_RUNTIME_PREVIEW=1` and a compatible Ori checkout is configured. The preview forces deterministic local execution and returns only reviewable hints; no raw child text or project content is sent to Ori.

## Verification

- `pnpm exec vitest run apps/tutor-api/src/oriRuntimeRoute.test.ts apps/web/src/oriReviewClient.test.ts`
- `pnpm exec tsc --noEmit`
- `pnpm format:check`
- `pnpm lint`
- Experimental Playwright run with the build flag enabled

Playwright currently mocks the HTTP response and does not prove a live Ori process. The separate cross-repository gate covers the real Ori process. A single browser-to-real-Ori test remains a release gate.

**Branch policy:** changes stay on `integration/ori`; no promotion to `main` or `develop`.
