# Deployment unit - issue #75

## Changed units

- New workspace package: `@agorix/proposals`.
- Studio package dependency/update to consume shared proposal semantics.
- Web package dependency for proposal card view-model helpers.
- Agora governance artifacts/evidence.

## Rollout

No runtime service, migration or environment variable is required. This introduces shared domain behavior and tests for later UI slices.

## Backout

Revert the new package, package dependency changes and Studio integration. No persisted project schema migration is introduced.
