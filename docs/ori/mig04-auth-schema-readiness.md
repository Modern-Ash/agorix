# MIG-04 shared AuthService schema readiness

The shared-auth production host now validates both PostgreSQL account and session tables before starting its authenticated HTTP listener. The check is read-only, rejects missing required columns, and closes the owned AuthService pool on startup failure. Migrations must be applied by deployment tooling, never implicitly during process startup.

The PostgreSQL acceptance suite also verifies readiness from a separate client. This protects against a deployment in which the canonical project tables exist but AuthService tables have not yet been migrated.

This is a deployment safety gate, not the final browser integration: real web login and `main.ts` wiring, cookie compatibility and authorized propose/decision/apply E2E remain required under #1007. The pilot remains disabled.
