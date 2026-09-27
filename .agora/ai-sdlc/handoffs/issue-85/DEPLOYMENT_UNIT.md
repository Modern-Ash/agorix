# Issue 85 Deployment Unit

## Unit

Library/domain contract change only. No production deployment, runtime service rollout or migration job is required.

## Changed Surfaces

- `packages/tutor-contract` contract exports and tests.
- `pnpm-lock.yaml` updated for workspace dependency on `@agorix/proposals`.
- `docs/architecture/adr/0004-learning-companion-contract.md`.

## Consumer Impact

Existing `Tutor*` exports remain available. New consumers can adopt Learning Companion APIs incrementally. Existing web and tutor-api builds pass without source migration in this issue.

## Rollout

Merge through normal PR review. Later issues may migrate provider adapters and UI surfaces onto the new contract.
