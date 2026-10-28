# MIG-04 AuthService-backed TutorServer

The `createOriMig04PgAuthenticatedTutorServer` composition combines Agorix's real AuthService session resolution with the existing PostgreSQL CAS and canonical review workflow.

The host must supply trusted session-token extraction, an authenticated active-project selector, canonical project repository, shared PostgreSQL pool, learning context and an explicit rollout decision. The composition does not derive identity from request headers and does not enable the learner pilot.

Token rotation must be delivered through the trusted response handler; otherwise the resolver rejects the session. The production `main.ts` remains unchanged until infrastructure providers can be wired and verified. This integration is not a rollout authorization.
