# MIG-04 shared AuthService production composition

`startOriMig04PgSharedAuthProductionHost` now composes the real PostgreSQL-backed AuthService account and session repositories with the integrated Ori host, using the same connection string. The AuthService and Ori pools are owned by the returned lifecycle and closed on startup failure or shutdown. Startup rejects environment-only pilot activation, missing database configuration, and unsupported Unix socket transport.

**Remaining release blockers:** the deployed web login must be configured to use these same PostgreSQL repositories and secure cookie contract; production `main.ts` still needs explicit trusted wiring and must preserve its legacy routes. Session-project selection and revocation must be called by the real login/logout/account lifecycle. Successful authenticated propose/decision/apply and cross-owner denial remain to be verified. This PR does not enable the pilot.
