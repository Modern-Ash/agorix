# MIG-04 canonical PostgreSQL persistence

`createOriMig04PgCanonicalInfrastructure` creates one owned PostgreSQL pool and provides both the production `SqlProjectRepository` and the MIG-04 transaction provider over that same pool. This avoids divergent databases between ownership reads and fenced CAS writes.

The deployed database must have the canonical `agorix_projects` schema from `@agorix/project-repository` and the MIG-04 policy/allowlist migrations applied before startup. No automatic migrations or in-memory fallback are provided.

The caller owns `close()` and must ensure cleanup on startup failure and shutdown. This factory is not yet wired into `main.ts`; trusted session-token extraction and server-side active-project selection remain deployment requirements for #1007.
