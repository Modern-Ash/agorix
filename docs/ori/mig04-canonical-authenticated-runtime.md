# MIG-04 canonical authenticated runtime

`startOriMig04PgCanonicalAuthenticatedRuntime` composes the production SQL project repository and fenced CAS using one owned PostgreSQL pool. It intentionally does not accept a separately configured repository, preventing ownership checks and project writes from targeting divergent databases.

The runtime requires trusted AuthService, session-token extraction, active-project selection, learning context, Ori root, world and rollout policy. It verifies the durable disabled policy before opening an HTTP listener and releases the pool on startup failure or shutdown.

This is an infrastructure-owned entrypoint, not an environment activation switch. It does not modify `main.ts` or enable the learner pilot. Deployment-level authentication and canonical project acceptance remain required to close #1007.
