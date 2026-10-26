# Ori internal adult review pipeline

This increment composes existing independent security controls into one **unregistered, disabled-by-default** server-side function.

```mermaid
flowchart TD
  A["Trusted server caller"] --> B{"Feature enabled?"}
  B -->|No| X["Unavailable"]
  B -->|Yes| C["POST, HTTPS Origin, trusted Host, admin session, CSRF"]
  C -->|Denied| D["HTTP-style deny result"]
  C -->|Allowed| E["Per-principal rate limiter"]
  E -->|Over quota| D
  E -->|Allowed| F["512-byte streaming body reader + strict JSON schema"]
  F -->|Invalid| D
  F -->|Valid| G["Internal plan review + schema/context validation"]
  G -->|Valid| H["Review result (internal only)"]
  G -->|Invalid| X
```

## Constraints

- No HTTP route, public endpoint, Kids response or program modification.
- The gate defaults to disabled and returns unavailable without invoking Ori.
- Session identity is derived from server-side `AdminAuth`, never client JSON.
- The plan is revalidated against the strict schema and requested mission/stage.
- The limiter is process-local, not distributed.

## Before any HTTP exposure

Require trusted reverse-proxy host configuration, explicit adult-only route registration, authentication/CSRF negative tests, request abort handling, HTTP connection cleanup, audit/privacy review and load tests. No deployment is authorized by this PR.

All six Ori Integration CI jobs must pass before merging into `integration/ori`.
