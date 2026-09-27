# Test Strategy

## Package checks

- `pnpm --filter @agorix/vscode-extension build` verifies extension package compilation.
- `pnpm --filter @agorix/vscode-extension test` verifies project open, mapping, step/evidence and ProgramProposal boundaries.

## Repository checks

- `pnpm format:check`
- `pnpm lint`
- `pnpm build`
- `pnpm test`

## Acceptance focus

Tests prove the first Studio slice opens Web-compatible stored projects, maps canonical nodes to editor ranges, drives preview/inspector from the same runtime evidence, requires explicit proposal apply and leaves rejection non-mutating.
