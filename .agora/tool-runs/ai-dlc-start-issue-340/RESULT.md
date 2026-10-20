---
schema: "agora/tool-result/v1"
run: "ai-dlc-start-issue-340"
status: "completed"
exit-code: 0
result-kind: "work-item"
---

# Tool result ai-dlc-start-issue-340

## Standard output

    {"assignees":[],"body":"Part of the Web production epic (agorix.modern-ash.com).\n\n## Goal\nA reproducible container that serves the built Web/PWA, same pattern as the existing `modern-ash-web` nginx container on the host.\n\n## Scope\n- `deploy/web/Dockerfile` (multi-stage: Node 22 + pnpm 9 build -> `nginx:alpine`) and `deploy/web/nginx.conf`.\n- `deploy/web/docker-compose.yml`: `restart: unless-stopped`, publish only on `127.0.0.1:<port>` (never 0.0.0.0; the tunnel is the only ingress). Pick a free host port (80, 3001, 3100, 54321/2 are taken).\n- nginx must emit the exact headers from `apps/web/public/_headers` (single source: `apps/web/src/securityHeaders.ts`); add a test or script that fails on drift between nginx.conf and securityHeaders.ts.\n- `sw.js` and `index.html` served with `Cache-Control: no-cache`; hashed `assets/*` immutable; `manifest.webmanifest` correct MIME; gzip/brotli on.\n- SPA fallback to `index.html`; `/healthz` returning 200.\n- No dev backend in the image (`AGORIX_DEV_BACKEND` unset, `/__dev/auth` returns 404).\n\n## Acceptance\n- `docker compose up -d --build` gives a healthy container; `curl -sI localhost:<port>` shows the full header set.\n- Image contains only `dist` + nginx config.","createdAt":"2026-10-20T21:21:38Z","labels":[{"id":"LA_kwDOUkmvsc8AAAAC3QYsLA","name":"enhancement","description":"New feature or request","color":"a2eeef"}],"milestone":null,"number":340,"state":"OPEN","stateReason":"","title":"Web prod: container image serving apps/web/dist with security headers","updatedAt":"2026-10-20T21:21:38Z","url":"https://github.com/Modern-Ash/agorix/issues/340"}

## Standard error

    (empty)
