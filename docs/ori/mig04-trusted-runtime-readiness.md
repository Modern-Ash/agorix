# MIG-04 durable startup readiness

The infrastructure-owned entrypoint `startOriMig04PgHostWithReadiness` verifies the shared PostgreSQL rollout policy before opening the HTTP listener.

A deployment is admitted only when its policy row exists and is explicitly disabled, human authorization is false, and the kill switch is true. Missing policy, malformed deployment ID, unavailable database, and active rollout state all prevent startup. The query uses a released pooled client.

This is a **startup gate**, not a replacement for request authentication or transactional CAS authorization. The existing CAS operation still checks the durable policy under a row lock. This entrypoint deliberately does not activate the pilot or create missing policy rows.

Production `main.ts` still requires real authenticated session, canonical repository, learning context and shared PostgreSQL dependencies before #1007 can be closed.
