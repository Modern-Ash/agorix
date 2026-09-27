# Issue 94 Test Strategy

## Deterministic Unit Tests

Provider-runtime tests cover:

- non-default base URL;
- configured model id;
- optional auth absent and present;
- capability negotiation and structured-output mismatch;
- malformed response as `invalid-response`;
- authentication failure;
- timeout, cancellation and unsupported capability;
- health for llama.cpp-style and vLLM-style deployment fixtures.

## Global Verification

Run `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test`, and `pnpm build`.
