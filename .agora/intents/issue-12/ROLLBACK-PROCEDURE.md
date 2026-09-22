---
schema: "agora/rollback-procedure/v1"
id: "issue-12-program-model-schema"
work: "program-model/schema-v1"
---

# Rollback procedure: program-model schema

1. `git revert <merge-commit>` on `main` removes `schema.ts`, `validate.ts`,
   `fixtures.ts` and their tests, restoring `packages/program-model`'s issue #11
   placeholder.
2. `apps/web`'s import of `PACKAGE_NAME` from `@agorix/program-model` is
   unaffected (that export predates and survives this issue).
3. No persisted data exists yet (no persistence implementation until issue #28),
   so there is no migration/data-loss concern from reverting.
