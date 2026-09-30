# Issue 86 Rollback Procedure

Non-authoritative operations artifact for governed Work `issue-86-delivery/issue-86`.

## Rollback scope

The issue #86 change set consists of:

- intent-to-plan contract implementation and tests in `packages/tutor-contract/src/`
- learner intent dialogue changes in `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`, `apps/web/src/App.css` and `apps/web/src/i18n.ts`
- related Agora AI-SDLC handoff, construction, verification and evidence artifacts under `.agora/`

## Rollback steps

1. Revert the issue #86 commit, or revert the PR merge commit on `main`.
2. Run `pnpm install --frozen-lockfile` if dependencies are absent; no new external dependency is expected for this issue.
3. Run `pnpm lint`, `pnpm test` and `pnpm build` and confirm all three pass.
4. Run `pnpm security:check` and confirm `security baseline: PASS`.
5. In the web UI, confirm the companion panel no longer shows the issue #86 intent-to-plan dialogue before any AI proposal exists.

## Ordering

Revert the tutor-contract and web UI changes together. Reverting only the UI would leave unused contract APIs/tests; reverting only the contract would break the web import/build path.

## Risk of rollback

- Removes the learner intent planning surface and deterministic contract added for issue #86.
- No data migration, persisted learner state, external service, secret or provider configuration is introduced by this issue, so rollback does not require data restoration.
- Existing run/step/reset block behavior is preserved by the rollback target because issue #86 adds a pre-proposal planning surface rather than changing canonical program execution.
