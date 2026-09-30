<!-- agora-ai-sdlc:deterministic-operations/v1 -->

# Rollback procedure — issue-87

Work: `issue-87-delivery/issue-87` · revision 1 · stage `operations`.

This artifact is non-authoritative preparation produced by the executor. Agora
Flow owns registration, gate evaluation and every lifecycle decision. Nothing here
authorizes a merge, a revert or a gate bypass.

## Rollback risk assessment

| Dimension | Assessment |
| --- | --- |
| Blast radius | One domain package: `packages/proposals` |
| Data/schema impact | None. Canonical program schema and `localStorage` persistence format are unchanged. |
| Stored user data | No migration, no rewrite, no orphaned records. A rollback restores code only. |
| Dependency impact | None. No package.json, lockfile or workspace change. |
| Provider impact | None. No provider adapter, credential or model change. |
| Reversibility | Full. Additive code + tests only; revert is a single-commit-safe operation. |
| Irreversible steps | None identified. |
| Currently reachable | Only the pre-merge path. The delta is uncommitted and no PR exists. |

## Scope note added in this iteration

Two divergences from the issue's non-acceptance normative text were identified
(source-verified in `OPERATIONAL-READINESS.md`, findings P-1 and P-2): the
"optional concept tags" protocol field is not representable, and the `reorder`
operation is not implemented. Neither is a security control and neither is
covered by the issue's `Acceptance` checklist, so neither widens the revert
surface. Reverting this Work restores `packages/proposals` to its `385c711`
behaviour in full, including both divergences — i.e. a rollback does not
partially retain them, and does not need a paired follow-up commit to undo
them. They are decisions for the accepting human, not rollback obligations.

This procedure was re-registered in Core in the current operations iteration
against revision 1, after all five deterministic gates were re-run green against
the same tree state (`pnpm lint`, `pnpm tsc --noEmit`, `pnpm test`, `pnpm build`,
`pnpm security:check`; 30 files / 488 tests; 4 / 4 / 191 scan counts). Nothing in
the revert surface changed since the previous iteration, so no path below needed
amendment.

## Current state of this Work (re-confirmed in this iteration)

The product delta for this Work is **uncommitted** on `ai-sdlc/issue-87` at base
HEAD `385c7119bded2aa3a5c9a2a792306314d2cd5e43`
(`packages/proposals/src/index.ts` +16, `packages/proposals/src/index.test.ts`
+192) and **no PR exists**. Procedures B and C therefore do not apply yet: there
is no merge SHA to revert and nothing has been served. The only applicable action
today is the pre-merge path below.

## Pre-conditions before using this procedure

0. If the delta is still uncommitted with no PR, rollback is "do not commit" or
   `git restore packages/proposals` on the branch. There is no revert to author
   and no user-visible impact, because the change was never released.
1. The PR carrying this Work has been merged (or is about to be merged) into
   `main`. Until then, the correct action is to close the PR, not to roll back.
2. The failure is attributable to this Work, not to a concurrent change on
   `main`. Confirm by reproducing the symptom at the pre-merge base commit.
3. No human approval, gate decision or lifecycle transition is recorded as a
   result of this procedure. Rollback is a repository operation, not a
   governance operation.

## Procedure A — pre-merge (PR not yet merged)

Preferred and least disruptive.

1. Identify the branch commits for this Work:
   `git log --oneline main..ai-sdlc/issue-87`
2. Revert or drop the Work commits on the governed branch, or close the PR.
3. Re-run the deterministic gates to confirm `main` is unaffected:
   `pnpm lint`, `pnpm tsc --noEmit`, `pnpm test`, `pnpm build`, `pnpm security:check`
4. Record the reason in the PR/issue thread. Do not close the source issue; its
   conditions are unmet and the rollback is not a resolution.

Expected result: zero user impact; nothing was ever released.

## Procedure B — post-merge, no release artifact deployed

1. Create a revert commit on a new branch off `main`:
   `git revert --no-edit <merge-sha>` (or the specific Work commit SHA).
2. Open a PR that states the observed symptom, the reverting commit and the
   verification result. Request human review; do not self-merge.
3. Re-run all deterministic gates on the revert branch and confirm the same
   green set recorded in `OPERATIONAL-READINESS.md`:
   `pnpm lint`, `pnpm tsc --noEmit`, `pnpm test`, `pnpm build`, `pnpm security:check`.
4. On merge, `main` is restored to pre-Work behavior.

Because this Work is a POC with no hosted deployment, the build output is
regenerated per developer/CI run; there is no artifact store to purge and no
cache to invalidate beyond a normal CI rebuild.

## Procedure C — post-merge, client bundle already served

Applies only if `apps/web/dist` was served from a static host.

1. Complete Procedure B first; the code fix is the rollback.
2. Redeploy the reverted `apps/web` build so the served bundle matches `main`.
3. Hard-refresh / purge the service worker cache for the affected scope. The
   service worker in `apps/web/public/sw.js` caches shell assets; a stale cache
   can otherwise keep serving the pre-revert bundle.
4. Verify in a clean profile that the app loads and the learning flow runs
   without AI availability.

## Procedure D — rollback invalidation

Do not use any of the above if the delta is not the cause. Specifically:

- If `main` shows the symptom with this Work reverted, the cause is elsewhere;
  stop and open a separate investigation. Do not expand this Work's scope.
- If a concurrent PR is also failing, coordinate the revert order so the two do
  not conflict in `packages/proposals`.
- Do not resolve a rollback by loosening `assertAllowedKeys`, relaxing
  `validateProgram`, or suppressing the `security:check` baseline. Removing a
  fail-closed validation control is a product decision requiring explicit
  human authority, not a rollback mechanism.

## Verification after any rollback

Run and record:

```bash
pnpm lint
pnpm tsc --noEmit
pnpm test
pnpm build
pnpm security:check
```

All five must exit 0. If any fails after the revert, the Work was not the sole
cause — stop and report rather than iterating on the revert.

## Forward-fix alternative

Because the change is additive hardening plus tests, the alternative to rollback
is a forward fix: add the missing allowed key or handling to
`packages/proposals/src/index.ts` on a new commit, with a test in
`packages/proposals/src/index.test.ts`, and re-run the gates. A forward fix
preserves the fail-closed control. Prefer it whenever the rollback would remove
a safety property rather than a defect.
