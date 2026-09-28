# Issue 93 Test Strategy

## Deterministic Unit Tests

Provider-runtime tests use injected fetch doubles to cover:

- configured endpoint and model selection;
- absence of Authorization credentials;
- successful structured Learning Companion response;
- health available/unavailable;
- structured-output capability failure;
- unavailable daemon/provider response;
- malformed model output as `invalid-response`;
- request timeout;
- cancellation;
- unsupported capability.

## Global Verification

Run the same broad checks used by CI:

- typecheck with `pnpm tsc --noEmit`;
- lint with `pnpm lint`;
- tests with `pnpm test`;
- build with `pnpm build`.

## Optional Local Integration

A real Ollama daemon is not required for CI. Optional local integration can be performed manually when Ollama and a configured model are available.
