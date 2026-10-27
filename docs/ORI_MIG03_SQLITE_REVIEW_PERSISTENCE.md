# MIG-03 SQLite educator review persistence

This module persists educator decisions, evidence digests and append-only application audit rows using SQLite transactions. It is an opt-in single-host storage boundary; it does not expose an HTTP route.

## Invariants

- An authenticated host supplies the verified educator principal and the mission allowlist from a trusted evidence snapshot, **never from browser input**.
- `submit` uses a revision and evidence digest as a compare-and-swap precondition inside `BEGIN IMMEDIATE`.
- Evidence replacement advances the revision, makes earlier decisions inactive and retains earlier audit rows.
- Reopening the same database retains decisions and audit events.
- The database is local. Multi-instance deployments require a shared transactional datastore.
- No function in this module grants pedagogical signoff or authorizes child-facing rollout.

## Production gaps

The host must bind the allowlist to the same persisted evidence version and authorize the reviewer using real administrative authentication. This module does not yet persist the full evidence matrix, so it is not a standalone production workflow. Database migrations, backups, retention policy, tamper-evident off-host audit replication and multi-instance coordination are required before production. SQLite local file permissions are not a substitute for those controls.
