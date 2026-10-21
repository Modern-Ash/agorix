# Issue 340 Level 1 Plan

1. Read `securityHeaders.ts`, `_headers`, vite preview config and the existing security baseline script.
2. Write the failing header-drift test first (nginx.conf vs securityHeaders.ts), then nginx.conf.
3. Write the Dockerfile (multi-stage) and a `.dockerignore`.
4. Write docker-compose.yml bound to 127.0.0.1:8470 with healthcheck.
5. Add cache/MIME rules and SPA fallback; `/healthz`; block `/__dev/*`.
6. Build the image and verify behaviour with curl against the running container.
7. Swap the temporary `agorix-web-tmp` container for the compose service on 8470.
8. Run `pnpm verify`; capture construction evidence.
