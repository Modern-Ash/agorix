# MIG-04 integrated deployment host

`startOriMig04PgIntegratedHost` is the single composition root for the authenticated Ori host. It creates one owned PostgreSQL pool for canonical projects, session-project selection, session lifecycle, and fenced CAS. It wires secure session cookies, AuthService resolution and verified session rotation to the canonical HTTP TutorServer.

Startup fails closed on missing authentication/learning/rollout providers, missing durable disabled policy, missing canonical project schema or missing session-project mapping schema. Shutdown closes the listener and pool, and is idempotent. The returned project lifecycle is available only to trusted server-side account/session handlers.

## Deployment release blockers

This PR does not fabricate a session repository or activate the learner pilot. Before replacing the legacy `main.ts` startup, deployment must supply a **real shared AuthService account/session repository**, compatible web login cookie transport, trusted account lifecycle hooks for project selection/revocation, and a real learning context provider. Production migrations must be applied before startup.

The acceptance test exercises the integrated HTTP listener against PostgreSQL, including denied anonymous apply and resource shutdown. It is not a successful authenticated propose/decision/apply test. #1007 stays open until those end-to-end acceptance criteria are met.
