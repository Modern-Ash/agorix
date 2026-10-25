# Ori experimental adult-review HTTP handler

This increment introduces a standalone HTTP adapter that translates results from the internal Ori review pipeline into HTTP responses. It is **not registered in the main tutor server** and cannot be reached by Kids.

## Security behavior

- The existing pipeline must approve feature activation, trusted host, HTTPS Origin, session, CSRF, rate limit, streaming body and plan schema.
- The handler returns JSON with `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`.
- Unexpected pipeline errors return a generic 503 without exposing provider details.
- Tests use an actual loopback Node HTTP server with synthetic admin sessions and plans.

## Important limitation

The test server is HTTP loopback while its simulated Origin is HTTPS. This verifies the preflight header policy but **not actual TLS termination, reverse-proxy trust or real cookie authentication**. Do not expose this handler in production without end-to-end session/CSRF tests and a trusted TLS proxy configuration.

No route is registered, no child-facing behavior changes, and no deployment is authorized.
