# Issue 100 Test Strategy

## Deterministic Tests

- `packages/tutor-contract/src/index.test.ts`: adversarial fixtures for PII request, over-assistance, hidden provider action, stale ProgramProposal and invented debugger facts.
- `packages/provider-runtime/src/index.test.ts`: local Ollama-style and remote OpenAI-compatible mocked adapters reject the same unsafe payload as `invalid-response`.
- Provider-runtime rejection test verifies the accepted program remains unchanged and deterministic runtime can still execute after rejection.

## Commands

- `pnpm exec vitest run packages/tutor-contract/src/index.test.ts packages/provider-runtime/src/index.test.ts`
- `pnpm run format:check`
- `pnpm run lint`
- `pnpm run test`
- `pnpm run build`

## Economics

All tests are mocked/local and require no provider credentials, network services or frontier calls.
