# Test strategy - issue #121

## Automated tests

The new cross-surface test suite covers:

- Web-created project opens in Studio without semantic drift.
- Studio-modified canonical project reopens through Web persistence.
- Web -> Studio -> Web round trip preserves semantic equivalence.
- Unsupported future schema fails with `UNKNOWN_VERSION`.
- Presentation state and locale changes do not affect semantic hash.
- UI-specific identifiers are rejected from canonical program state.

## Verification commands

- `pnpm --filter @agorix/persistence build`
- `pnpm --filter @agorix/vscode-extension test`
- `pnpm build`
- `pnpm test`
- `aisdlc verify --root . --swarm issue-121-delivery --work issue-121 --run --json`
