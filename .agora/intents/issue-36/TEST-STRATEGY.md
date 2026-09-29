<!-- agora-ai-sdlc:construction/v1 -->

# Test Strategy — issue-36

## Unit (Vitest, `apps/web/src/manifest.test.ts`)

Asserts the manifest declares name/short_name/start_url/display/colors,
at least one `any`-purpose and one `maskable`-purpose icon, and is valid
JSON.

## E2E (Playwright, `apps/web/e2e/smoke.spec.ts`, two new tests)

- "app is installable": asserts the `<link rel="manifest">` href, fetches
  and validates the manifest response, and confirms a service worker
  registers and becomes active.
- "app shell stays available offline after the service worker installs":
  loads the page with the SW active, reloads once more so every requested
  asset passes through the fetch handler's runtime cache, then sets the
  browser context offline and reloads — asserts the main editor heading and
  Run button are still visible.

Both run alongside the existing 22 e2e tests (desktop project only, per
existing `playwright.config.ts` — no new project/viewport was added). Full
suite: 24/24 passing.

## AC-002 through AC-009: no new tests needed

These were already covered by the pre-existing e2e suite before this issue.
Confirmed by running the full suite unmodified (22/22 passing) before
adding any new code, then again after (24/24 passing, no regressions).

Repository-wide: `pnpm test` 374/374 (was 371/371 before this issue: +3
manifest unit tests).
