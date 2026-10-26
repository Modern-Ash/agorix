# Ori review: existing admin-session gate

This isolated increment adapts Agorix's existing `AdminAuth.read(request)` session validation to the internal Ori review function.

- No session: no Ori call and an `unavailable` result.
- Authenticated administrator: subject to the existing host-owned mission allowlist and disabled-by-default gate.
- Session parsing failures: fail closed.
- No role, identity, token or CSRF value is accepted from client JSON.
- No HTTP endpoint or child-facing response is introduced.

## Critical security gate before HTTP exposure

The existing admin session alone is **not sufficient** for a new HTTP endpoint. A future route must enforce same-origin and CSRF checks, request rate limits, request-body validation and adult-only authorization, with negative tests. This module is only a server-side building block.

No change is authorized for `main`, `development` or the existing Kids response.
