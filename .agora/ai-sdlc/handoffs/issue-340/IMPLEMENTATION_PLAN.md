# Issue 340 Implementation Plan

1. Parity test first (red, 4 failures).
2. `nginxSecurityHeadersFile()` and generated `security-headers.conf`; `nginx.conf` (tests green).
3. Dockerfile, `.dockerignore`, compose; `apps/project-api` must stay in the build context because the web typecheck imports it.
4. Replace the temporary `agorix-web-tmp` container; curl verification; `Cache-Control` for hashed assets without `always` so 404s are not cached.
5. `pnpm verify`, `pnpm format:check`, PR.
