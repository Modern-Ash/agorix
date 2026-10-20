# Issue 340 Logical Design

- `securityHeaders.ts` gains `nginxSecurityHeadersFile()` rendering `add_header <name> "<value>" always;` lines.
- `deploy/web/security-headers.conf` is that output, committed, and included from every nginx `location` that sets its own `add_header` (nginx does not inherit otherwise).
- `deploy/web/nginx.conf` defines locations: `/__dev/` (404), `/healthz`, `/sw.js`, `/index.html`, `/manifest.webmanifest`, `/assets/` (immutable, 404s uncached), `/` (SPA fallback).
- Dockerfile: Node 22 build stage -> `nginx:alpine` with only `dist`, conf and headers; compose publishes `127.0.0.1:8470:80`.
