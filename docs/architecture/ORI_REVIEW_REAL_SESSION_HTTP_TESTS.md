# Ori adult review — real session HTTP regression tests

This increment extends the isolated Node loopback HTTP test harness to use the real `AdminAuth` implementation rather than a stubbed session reader.

## Coverage

- Missing admin cookie returns 401 and never invokes Ori review.
- A cookie issued by `AdminAuth.signIn` plus its CSRF token allows the synthetic plan review.
- Wrong or missing CSRF returns 403.
- `AdminAuth.signOut` revokes the session; subsequent requests return 401.
- An expired session returns 401.
- Cross-origin requests return 403 even with valid credentials.
- The disabled-by-default feature returns 503 even with a valid session.

All tests use synthetic credentials and plans. The HTTP listener is loopback-only, created inside tests, and is never registered in the production tutor server.

## Remaining gaps

These tests validate HTTP request handling with real in-process cookies and session lifecycle. They do **not** verify a real HTTPS reverse proxy, TLS, cross-instance session persistence, distributed rate limits, or child-facing pedagogical behavior. Those are separate release gates.

Merge only into `integration/ori` after formatting, lint, TypeScript, unit/regression tests, build, and real Ori interoperability all pass.
