# Issue 340 Measurement Criteria

- `docker compose up -d --build` yields a healthy container.
- `curl -sI` shows the full production header set on `/`, `/sw.js`, an asset, a 404 and `/healthz`.
- `sw.js` and `index.html` return `Cache-Control: no-cache`; `manifest.webmanifest` returns `application/manifest+json`.
- `/__dev/auth` returns 404; unknown paths fall back to `index.html`.
- The parity test passes and fails when a header value is altered.
- `ss -tln` shows 8470 bound only to 127.0.0.1.
- `pnpm verify` passes.
