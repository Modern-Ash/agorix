# Issue 102 Rollback Procedure

Non-authoritative operations artifact for governed Work `issue-102-delivery/issue-102`.

## Rollback scope

The issue #102 change set consists of:

- `packages/learning-evidence/` (new package: `package.json`, `tsconfig.json`, `vitest.config.ts`,
  `README.md`, `src/*.ts`)
- `docs/product/LEARNING_EVIDENCE.md` (new product document)
- `pnpm-lock.yaml` (workspace entry for `@agorix/learning-evidence`)
- `eslint.config.js` (project glob entry)
- `README.md` (documentation link)
- `docs/product/PEDAGOGY.md` (evidence-model section)
- issue #102 Agora handoff, construction and verification artifacts under `.agora/`

## Rollback steps

1. Revert the issue #102 commit, or revert the PR merge commit on `main`.
2. Run `pnpm install --frozen-lockfile` if dependencies are absent, or `pnpm install` after the
   lockfile reverts so `@agorix/learning-evidence` is dropped from the workspace graph.
3. Run `pnpm lint`, `pnpm test` and `pnpm build` and confirm all three pass.
4. Run `pnpm security:check` and confirm `security baseline: PASS`.
5. Confirm `docs/product/LEARNING_EVIDENCE.md`, the `README.md` link and the
   `docs/product/PEDAGOGY.md` section are absent and that `packages/learning-evidence` no longer
   resolves as a workspace project.

## Ordering

Because `pnpm-workspace.yaml` selects `packages/*` by glob, the package directory must be removed in
the same revert as the lockfile entry. A revert that leaves `packages/learning-evidence/package.json`
in place while restoring the previous lockfile will fail `pnpm install --frozen-lockfile`; use plain
`pnpm install` in that partial state.

## Risk of rollback

- Removes the executable learning-evidence and assessment model, returning issue #102 to a
  documentation-only state. `docs/product/LEARNING_EVIDENCE.md` states the package is the source of
  truth for validation, so removing the package without also reverting the document would leave a
  dangling claim; revert both together.
- No data, schema or persisted learner state is affected: the package introduces no persistence
  migration and no shipped runtime consumer, so there is nothing to restore from backup.
- Existing product behavior is unaffected either way because no shipped artifact imports the new
  package yet.
