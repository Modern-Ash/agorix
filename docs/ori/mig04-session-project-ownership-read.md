# MIG-04 active-project ownership read gate

A session-project mapping is not authorization by itself. The PostgreSQL lookup now joins `agorix_ori_session_projects` to the canonical `agorix_projects` row on **both** account and project identifiers. A stale mapping left after project deletion, or a mapping pointing at a project owned by another account, resolves to no active project.

The authenticated identity resolver still checks ownership through the canonical repository independently. The SQL join is an additional fail-closed guard, not a substitute for authentication or revocation of session mappings.

Production `main.ts` session lifecycle wiring remains outstanding under #1007; this change does not enable rollout.
