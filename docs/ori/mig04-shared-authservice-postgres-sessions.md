# MIG-04 shared durable AuthService sessions

`createOriMig04PgAuthSessionRepository` implements the actual `@agorix/auth-service` SessionRepository contract against PostgreSQL. It stores **token hashes**, not raw bearer tokens. It supports lookup, create, atomic conditional rotation, revocation and account-wide deletion. Two AuthService instances backed by the same database can resolve the same session record.

The SQL schema is exported for controlled migrations; startup does not create tables automatically. The integration test uses independent repository instances to verify cross-process-compatible persistence and rotation conflicts.

## Production integration still required

This is a real durable session repository, but it is **not yet proof that the web login uses it**. The deployed web login and tutor-api must both be configured to use the same account repository and this session repository, with compatible cookie names and rotation policies. A real shared account repository and explicit production `main.ts` composition are still necessary. The learner pilot remains disabled.

Before enabling rollout, verify login, session resolution, rotation, logout, account deletion and authenticated propose/decision/apply with both processes against the same PostgreSQL instance.
