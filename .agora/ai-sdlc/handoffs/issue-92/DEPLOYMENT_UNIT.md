# Issue 92 Deployment Unit

## Unit

Library/domain contract change only. No standalone runtime service, database migration, infrastructure rollout or production deployment is required.

## Changed Surfaces

- New `packages/provider-runtime` workspace package.
- Architecture docs and ADR 0005.
- Agora #92 governance artifacts.

## Consumer Impact

No current app source is migrated to the new runtime package in this issue. Later provider adapter issues (#93, #94, #95) can implement the contract.

## Rollout

Merge through normal PR review. CI verifies typecheck, lint, tests and build.
