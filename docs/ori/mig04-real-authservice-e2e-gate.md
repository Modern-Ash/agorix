# MIG-04 real AuthService cross-process acceptance

This acceptance test uses two independent PostgreSQL clients and two real `AuthService` instances, with the production account and session repository adapters. It covers registration, sign-in, cross-process session resolution, token rotation, rejection of the old token, logout/revocation, and account deletion with subsequent credential rejection.

This closes an important test gap: prior tests exercised repository CRUD or mocked authentication, rather than real AuthService behavior over shared persistence.

## Remaining release gate

This is **not** the browser login or Ori propose/decision/apply acceptance. The deployed web login still needs to use the same account/session tables and cookie contract. `main.ts` still needs the trusted integrated host wiring, while preserving existing HTTP and Unix socket behavior. Complete authenticated Ori workflow E2E and cross-owner checks before closing #1007 or enabling the pilot.
