# Ori SQLite active-project persistence

Adds a local SQLite implementation of `OriActiveProjectPersistence` using Node's built-in `node:sqlite`. Records are keyed by accountId and sessionId, and use atomic upsert. Database files are created with restrictive permissions. The existing expiring store enforces TTL and the canonical project selector rechecks ownership.

This implementation is appropriate for a single Tutor API host with a persistent local volume. It is **not shared across containers or hosts**, and it is not yet wired into main.ts. Multi-instance deployment requires PostgreSQL or another shared transactional database. Session migration on rotation and logout cleanup remain separate lifecycle tasks.

Tests cover SQLite persistence, expiry, session isolation and integration with the authorized project selector. Related Ori #18 #20 #23 #28 #29. Target integration/ori.
