# Atomic SQLite session migration for Ori active projects

SQLite active-project persistence now exposes a transactional migration capability. The session lifecycle uses it when available. The migration runs inside BEGIN IMMEDIATE/COMMIT, updates the session key only for a non-expired selection, and rejects collisions with an existing destination record rather than overwriting it. Tests verify migration and collision isolation.

The generic persistence port still has a non-transactional fallback for adapters without `migrate`; production adapters must implement transactional migration or reject rotation requiring session-ID changes. This is single-host SQLite atomicity, not distributed transaction support. Authentication/logout hooks are still not wired into main.ts.

Target integration/ori. No public route activation or program writes.
