# Issue 340 Test Strategy

- Unit: `apps/web/src/nginxHeaders.test.ts` (header parity, include-in-every-location, `/__dev/` 404).
- Integration: container started via compose; curl matrix on `/`, `/sw.js`, manifest, asset, missing asset, `/healthz`, `/__dev/auth`, SPA route; gzip check; `ss` shows loopback binding.
- Regression: `pnpm verify`, `pnpm format:check`, CI on the PR.
