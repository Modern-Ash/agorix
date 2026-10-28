# MIG-04 authenticated PostgreSQL runtime

`startOriMig04PgAuthenticatedRuntime` combines the real `pg.Pool`, durable disabled-policy readiness and AuthService-backed TutorServer composition. The infrastructure owner must provide a trusted session-token extractor, active-project selector, canonical repository, learning context and rollout decision.

The runtime binds to loopback by default, rejects invalid ports, closes the PostgreSQL pool on shutdown and refuses to listen if the database or durable disabled-policy check fails. A rollout decision and the transactional CAS fence remain separate authorization boundaries.

This is **not** an environment-only pilot switch. Production `main.ts` remains unchanged until the deployed auth and repository providers can be supplied. Do not mark #1007 complete without a deployment-level authenticated HTTP and persistence acceptance test.
