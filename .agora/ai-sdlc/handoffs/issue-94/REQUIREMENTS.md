# Issue 94 Requirements

## Functional Requirements

1. Provide an OpenAI-compatible gateway implementation of `LearningCompanionProviderRuntime`.
2. Configure base URL and model id explicitly; no hard-coded model.
3. Support optional auth for remote or protected deployments while allowing unauthenticated local deployments.
4. Support timeout and cancellation.
5. Normalize provider errors into provider-runtime error codes.
6. Declare structured-output capability by configuration.
7. Avoid provider-specific domain fields.
8. Do not assume every compatible server supports every endpoint or feature.
9. Fail closed on malformed responses and capability gaps.
10. Use local mocks/fixtures in tests, not external services.

## Acceptance Trace

- Non-default base URL is supported.
- Model id is configuration.
- Auth is optional.
- Capability negotiation works.
- Malformed response returns `invalid-response`.
- Browser secrets are not required.
- Learning Companion contract matches Ollama/other providers.
- Tests use mock HTTP/fetch fixtures only.

## Out Of Scope

- Product provider selection UX (#96).
- Commercial provider migration (#95).
- Full conformance matrix (#97).
- Direct dependency on OpenAI SDK or product-specific APIs.
