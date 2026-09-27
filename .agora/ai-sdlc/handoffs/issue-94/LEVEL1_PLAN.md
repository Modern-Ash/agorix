# Issue 94 Level 1 Plan

## Intent

Add an OpenAI-compatible HTTP gateway adapter as a generic interoperability path for local/open inference servers, while preserving provider-neutral domain boundaries.

## Source Alignment

- GitHub issue: #94.
- Parent epic: #67.
- Depends on #92.
- Builds beside #93 but is protocol-compatible, not an OpenAI product dependency.

## Delivery Scope

1. Add config types and `createOpenAICompatibleProviderRuntime` to `@agorix/provider-runtime`.
2. Support configurable base URL, model id, optional auth token/header, capability subset, structured-output declaration and timeout.
3. Request chat/completions-style JSON output using fetch and injectable mocks.
4. Validate returned Learning Companion response before success.
5. Normalize unsupported capability, timeout, cancellation, unavailable provider, auth failure, provider error and invalid response.
6. Document local/open compatible deployment classes such as llama.cpp and vLLM.
7. Verify with deterministic tests and full repo checks.

## Out Of Scope

- OpenAI SDK dependency.
- Browser-side secrets.
- Guaranteed support for every compatible endpoint feature.
- External service tests.

## Implementation Sequence

1. Reuse provider-runtime helper patterns from the Ollama adapter.
2. Add gateway descriptor/config and capability negotiation.
3. Add request/response handling for compatible chat completions.
4. Add tests using injected fetch fixtures for local and protected deployments.
5. Add docs and run verification.

## Handoff Boundary

Construction may begin only after Product Owner and developer approval of inception.
