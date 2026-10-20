# Issue 340 Verification Evidence

- `pnpm verify` (frozen install, lint, test, build, security baseline): pass; 105 test files, 1455 tests passed.
- `pnpm format:check`: pass.
- New unit tests `apps/web/src/nginxHeaders.test.ts`: 4 red before implementation, 4 green after.
- Container `agorix-web` healthy; curl matrix confirmed full security headers on `/`, `/sw.js`, manifest, assets, 404, `/healthz`, `/__dev/auth` (404) and an SPA route; `sw.js`/index/manifest `no-cache`; manifest MIME `application/manifest+json`; gzip on assets; 8470 bound to 127.0.0.1 only.
- Public `https://agorix.modern-ash.com`: `/` and manifest carry the new headers; `/sw.js` served from a stale Cloudflare edge copy until expiry/purge (tracked in #341).
- PR #350 CI: all required jobs success except `browser-smoke` pending at time of writing.
