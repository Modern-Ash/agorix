# Issue 340 Requirements

Source facts are taken from GitHub issue #340; items marked (proposal) are AI proposals awaiting human decision.

## Functional Requirements

- `deploy/web/Dockerfile`: multi-stage, Node 22 + pnpm 9 build of `@agorix/web`, then `nginx:alpine` serving only `dist`.
- `deploy/web/nginx.conf` emits exactly the headers defined by `apps/web/src/securityHeaders.ts` (mirrored in `apps/web/public/_headers`).
- A drift check fails when nginx.conf and securityHeaders.ts disagree.
- `deploy/web/docker-compose.yml`: `restart: unless-stopped`, published only on `127.0.0.1:8470` (reserved in #341).
- `sw.js` and `index.html` are `Cache-Control: no-cache`; hashed `assets/*` are immutable; `manifest.webmanifest` is `application/manifest+json`; gzip enabled.
- SPA fallback to `index.html`; `/healthz` returns 200.
- The image contains no dev backend; `/__dev/auth` returns 404.
- (proposal) Replace the temporary `agorix-web-tmp` container created during #341.

## Out of scope

- Cloudflare configuration (#341), deploy/rollback script (#342), runbook (#343), client audit (#344), prod smoke (#345), accounts/API (#346+).
