# Ori adult-review HTTP preflight (not yet routed)

The internal `checkOriReviewHttpRequest` function prepares a strict security preflight for a future administrative POST endpoint. No HTTP route is registered and Kids remains unchanged.

## Checks

- POST only; HTTPS same-origin Host/Origin match.
- No credentials, path, query or fragment in Origin.
- JSON content type only.
- Existing `AdminAuth` session must be valid.
- The `x-agorix-admin-csrf` header must match the server-issued session token.
- All failures return explicit deny decisions; no Ori call is made here.

## Deployment caveats

This helper assumes a trusted reverse proxy preserves and validates Host and Origin. It intentionally rejects missing Origin and HTTP development origins. A future endpoint must additionally enforce a trusted host allowlist, request-body size and schema limits, rate limiting, adult permissions and audit controls. Session exceptions must also be handled fail-closed by the route.

This is not production-ready authentication infrastructure. Do not expose it to children or merge into stable branches.
