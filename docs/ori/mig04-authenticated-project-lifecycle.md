# MIG-04 verified account and project lifecycle

The integrated host now exposes `authenticatedProjectLifecycle` for trusted server handlers. Its `selectProject` operation uses the verified AuthService account and session, then relies on the canonical PostgreSQL ownership join to reject cross-owner projects. `logout` revokes only that session's active-project mapping. `revokeAccountSessions` clears every mapping after trusted account invalidation or deletion.

These functions must never be called with account/session identifiers taken from client headers, body or query parameters. The caller must resolve a session through AuthService first. These operations do **not** revoke the underlying AuthService token themselves: logout must also call the real session repository's revocation flow.

This change adds a production integration boundary and PostgreSQL acceptance, but it does not claim the web login already invokes it. Connecting actual web login/logout/project-change handlers, main.ts and authenticated propose/decision/apply E2E remains required before enabling the pilot.
