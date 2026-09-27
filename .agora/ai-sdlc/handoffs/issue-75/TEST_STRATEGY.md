# Test strategy - issue #75

## Tests

- `packages/proposals/src/index.test.ts` covers parse/validation, accept, reject, modify, invalid, stale, malformed, unknown operation, diff, affected mapping, audit and Web/Studio view models.
- Existing Studio tests continue to pass after delegating to shared proposal semantics.

## Commands

- `pnpm format:check`
- `pnpm lint`
- `pnpm build`
- `pnpm test`
- `aisdlc verify --root . --swarm issue-75-delivery --work issue-75 --run --json`
