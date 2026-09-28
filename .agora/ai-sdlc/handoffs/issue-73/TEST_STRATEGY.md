# Test Strategy - Issue #73

## Deterministic checks

- `git diff --check`
- `pnpm format:check`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- grep checks for Apache-2.0, CONTRIBUTING, GOVERNANCE and external-license boundaries
- local diff secret/PII scan

## Expected result

All checks pass. Documentation states formal Apache-2.0 license only after the root `LICENSE` exists.
