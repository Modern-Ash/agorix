# MIG-04 account-wide session mapping revocation

The PostgreSQL session-project lifecycle now provides `revokeAll(accountId)` to clear every active-project association for an account. This is intended for account deletion or administrative session invalidation after trusted authentication and authorization. The operation is scoped to the verified account identifier and uses a parameterized query.

The deployed account deletion flow must explicitly invoke this operation; this PR does not yet wire the web application's account lifecycle to tutor-api. Project mappings are not themselves authentication credentials, and the canonical repository continues to enforce ownership. No rollout is enabled.
