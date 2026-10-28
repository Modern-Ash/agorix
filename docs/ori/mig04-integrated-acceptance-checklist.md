# MIG-04 integrated acceptance and release checklist

The integrated host now has one PostgreSQL-backed composition root. This acceptance bundle verifies that a missing rollout policy blocks startup, missing trusted auth/learning/rollout providers are rejected before opening the database, anonymous HTTP apply is denied, and the server-owned project lifecycle rejects non-owned selection and absent-session rotation against real PostgreSQL.

## Remaining deployment-critical acceptance

- Provide the real shared AuthService account and session repositories; do not substitute in-memory or per-process stores.
- Confirm the web login issues the exact host-only cookie contract and that session rotation is persisted and delivered.
- Connect the account's active project selection, logout, session revocation and account deletion to the durable project lifecycle.
- Connect the integrated host to the production process startup without regressing existing TutorServer endpoints or socket support.
- Exercise authenticated propose, accept/reject, apply, cross-owner denial and CAS conflict with real canonical project rows.
- Test migrations, rollback, emergency disable and restart against a production-like deployment.

These are release gates, not completed capabilities. The pilot remains disabled and #1007 should remain open until the entire acceptance sequence passes.
