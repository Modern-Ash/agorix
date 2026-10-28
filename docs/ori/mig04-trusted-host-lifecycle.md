# MIG-04 trusted host lifecycle

The `startOriMig04PgHost` entrypoint starts an HTTP TutorServer only after the caller supplies the authenticated project resolver, canonical repository, verified learning context, shared PostgreSQL pool and explicit rollout decision. It binds to loopback by default and returns an idempotent close operation plus the durable emergency-disable callback.

This is an explicit infrastructure-owned entrypoint, **not** an environment-flag activation. A deployment must supply real implementations for all required dependencies and verify policy state before exposing learner routes. The existing `main.ts` remains unchanged and does not automatically activate Ori. A production deployment wiring and end-to-end authentication test are still required under #1007.

CI must pass the unit/regression suite and the isolated PostgreSQL integration workflow before merge.
