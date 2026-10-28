# MIG-04 verified learner event recording

`createOriMig04PgLearningEvents` provides a server-owned PostgreSQL writer for genuine learning observations. The caller must first authenticate the account and select a project; the SQL join independently enforces project ownership. Only bounded server-defined event kinds are accepted: attempt, hint, and learning stage. Counters are incremented atomically and capped at 100. Stage changes are explicit. No client-supplied owner ID or numeric counter is accepted by this adapter.

The existing `createOriMig04PgLearningContext` reads the same table. **This adapter is not yet wired to the actual web learning event handlers.** Production must call it from those trusted handlers after validating event provenance. An untrusted browser must not be able to invent attempts or hints to influence Ori.

Remaining #1007 gates: actual web event hookup, production `main.ts` composition with real world/rollout sources, and successful authenticated HTTP -> independent Ori process -> PostgreSQL fenced CAS application. Pilot stays disabled.
