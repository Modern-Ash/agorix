# MIG-04: authenticated PostgreSQL learning evidence and fenced Ori review

## Durable deployment boundary

The legacy `pnpm --filter @agorix/tutor-api start` entrypoint remains unchanged. To deploy the PostgreSQL **disabled-by-default** host, first apply the operator-managed canonical project, AuthService, session-project, rollout policy and learning-context migrations (including `docs/ori/sql/mig04-learning-context.sql`), then build and start:

```bash
pnpm --filter @agorix/tutor-api build
AGORIX_ORI_MIG04_DATABASE_URL='<server-owned PostgreSQL connection string>' \
AGORIX_ORI_MIG04_DEPLOYMENT_ID='<existing disabled-policy deployment id>' \
ORI_REPO_PATH='/absolute/path/to/trusted/ori/checkout' \
pnpm --filter @agorix/tutor-api start:ori-mig04
```

The deployment must already have an explicit `agorix_ori_rollout_policy` row with mode `disabled`, `human_authorized=false` and `kill_switch=true`. Startup validates the schema and durable disabled policy before listening. It does **not** run migrations, create operator authorization, or enable the pilot by reading environment flags.

`main-mig04.ts` deliberately provides a permanently false learner-visibility policy. A future pilot must instead be instantiated by the trusted `startOriMig04PgSharedAuthProductionHost` composition with an operator-reviewed canonical world and rollout provider. The server-side provider and transactional PostgreSQL CAS must both authorize each application. The ordinary `main.ts` cannot activate the pilot via environment variables.

## Learning events with verified provenance

Only authenticated, same-origin review handlers record evidence, using owner/project from the server-resolved session. The public `/api/tutor/ori/learning/event` route remains fail-closed: browser JSON cannot create learning events.

- A valid authenticated `/review/propose` help request records a **hint requested** event before evidence generation. It never accepts a browser-supplied counter.
- The canonical evidence resolver executes the **persisted**, owner-scoped program and only then asks for learning context. That trusted context provider atomically records an **attempt** after each completed canonical execution. Revalidation may execute the canonical program twice for one proposal; each successful run is a real observation.
- An **accepted** server-issued review decision records stage `connect`.
- An **applied** fenced CAS records stage `translate`. The successful CAS response includes `evidenceRecorded`; a post-commit recording outage does not misreport a committed project mutation as a failed write.

The project owner is independently verified in SQL. Counters are bounded (0–100), updates are atomic, and an owned project without an evidence row starts with zero attempts/hints and stage `explore`. No unauthenticated, disabled, cross-owner or unapproved operation can mutate a project. No fallback to unfenced `repository.update` is allowed in the trusted PostgreSQL path.

## Required E2E acceptance

The PR workflow `Ori MIG-04 PostgreSQL integration` checks out the **real** `Modern-Ash/ori` implementation using the existing read-only `ORI_READ_TOKEN` secret. It provisions PostgreSQL and runs `oriMig04PgRealAuthenticatedApplyE2e.test.ts`.

The test exercises registered browser login and rotating secure session cookies, canonical project selection, denied requests under disabled rollout, explicitly authorized test rollout, real independent Ori execution, proposed and accepted review, PostgreSQL CAS application, persisted revision and learning evidence, replay denial, and an emergency rollout disable with no additional program write. It is separate from the lower-level concurrent CAS tests.

To reproduce with an isolated disposable database:

```bash
ORI_MIG04_TEST_DATABASE_URL='postgresql://...' \
ORI_MIG04_REAL_ORI_ROOT='/absolute/path/to/ori' \
pnpm exec vitest run --no-file-parallelism \
  apps/tutor-api/src/oriMig04PgRealAuthenticatedApplyE2e.test.ts
```

No production database or child data should be used in these tests. Review the workflow results before merging #1065 or closing #1007.
