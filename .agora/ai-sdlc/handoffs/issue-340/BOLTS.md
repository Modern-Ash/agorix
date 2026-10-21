# Issue 340 Bolts

## Bolt A: Header Source And Drift Test

- Add a test that parses nginx.conf and asserts every header and value equals `webSecurityHeaders("production")`.
- Write the test before nginx.conf (red first).

## Bolt B: nginx Config

- Security headers on every response including errors (`always`).
- Cache policy, MIME for webmanifest, gzip, SPA fallback, `/healthz`, `/__dev/` returns 404.

## Bolt C: Image And Compose

- Multi-stage Dockerfile, `.dockerignore`, compose on 127.0.0.1:8470, healthcheck, restart policy.

## Bolt D: Live Verification

- Build and run; curl checks for headers, cache-control, content-types, fallback, healthz, 404.
- Replace `agorix-web-tmp`; run `pnpm verify`.
