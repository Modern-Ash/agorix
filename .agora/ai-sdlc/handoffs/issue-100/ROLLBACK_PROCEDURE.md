# Issue 100 Rollback Procedure

## Rollback Scope

Revert the issue #100 changes in:

- `packages/tutor-contract/src/learning-companion.ts`
- `packages/tutor-contract/src/index.test.ts`
- `packages/provider-runtime/src/index.ts`
- `packages/provider-runtime/src/index.test.ts`
- `docs/safety/AI_OUTPUT_VALIDATION.md`
- issue #100 Agora handoff/evidence artifacts

## Rollback Steps

1. Revert the issue #100 commit or PR merge commit.
2. Run `pnpm install --frozen-lockfile` if dependencies are absent.
3. Run `pnpm run test` and `pnpm run build`.
4. Confirm provider-runtime returns to schema-only validation behavior from before #100.

## Risk

Rollback removes the new child-safety validation boundary, so provider output would again rely on schema validation plus downstream proposal review only.
