# Ori adult-review rate limiting (internal only)

This increment adds a process-local, per-principal fixed-window limiter for a future authenticated adult review route. It does not register an HTTP endpoint or change Kids.

## Contract

- Default six accepted requests per 60 seconds per trusted principal key.
- Requests exceeding the limit are rejected before contacting Ori.
- Limits and windows are validated; malformed principal keys and invalid clocks fail closed.
- State can be cleared explicitly in tests. No prompt, program, child identifier, cookie, token or IP address is retained.

## Integration prerequisites

The host must derive a stable non-secret principal key from an authenticated server-side session, not client JSON. Apply this limiter only after the trusted-host, same-origin, session and CSRF checks. Never use a shared generic key that would allow one user to deny access to all others.

This is **not yet production-ready**: process-local state is not shared between replicas, the map is not bounded, and clock rollback requires an explicit operational policy. Before registering a route, add bounded storage/eviction, a monotonic time strategy, body-size/schema checks and distributed limits if multiple replicas are deployed.

The PR is stacked on #667 and must not be merged into `integration/ori` before its base is reconciled.
