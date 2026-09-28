# Deployment unit - issue #121

## Units changed

- `@agorix/persistence`: adds compatibility helpers and exports.
- `@agorix/vscode-extension`: adds deterministic cross-surface compatibility tests.
- Product documentation: adds cross-surface contract and Studio reference.

## Rollout

This is a source/test/documentation change only. No runtime environment variables, external services, migrations, or release steps are required.

## Backout

Revert the compatibility helper, test file and documentation additions. Existing project storage behavior remains backward compatible because `ProjectStore.save/load` is unchanged.
