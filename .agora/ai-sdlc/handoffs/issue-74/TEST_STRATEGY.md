# Test strategy - issue #74

This is a documentation/architecture issue. Verification focuses on deterministic repository health plus explicit testability statements in the contract.

## Commands

- `pnpm format:check`
- `pnpm lint`
- `pnpm build`
- `pnpm test`
- `aisdlc verify --root . --swarm issue-74-delivery --work issue-74 --run --json`

## Future Playwright coverage specified by the contract

- AI proposal cannot mutate canonical program before acceptance.
- Proposal, accepted code and executing instruction have distinct labels/states.
- Step advances current instruction and updates evidence.
- Code remains visible at tablet portrait/landscape/desktop breakpoints.
- Studio diff review follows the same ProgramProposal semantics.
