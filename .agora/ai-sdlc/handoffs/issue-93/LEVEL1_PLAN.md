# Issue 93 Level 1 Plan

## Intent

Implement the Ollama local-model adapter behind the provider runtime contract so Agorix has an open/local model path without coupling domain code to Ollama.

## Source Alignment

- GitHub issue: #93.
- Parent epic: #67.
- Depends on #92 provider runtime and #85 Learning Companion contract.
- Deterministic fake provider remains default for CI.
- Ollama capability support must be declared by configuration and verified by response validation.

## Delivery Scope

1. Add an Ollama runtime factory to `@agorix/provider-runtime`.
2. Model endpoint, model name, supported capabilities, timeout and structured output mode as configuration.
3. Implement health check against the configured local endpoint.
4. Convert Learning Companion requests into a constrained Ollama prompt/request.
5. Parse and validate structured model output before success.
6. Return normalized provider runtime failures for unavailable daemon, timeout, cancellation, unsupported capability and invalid response.
7. Add deterministic tests using injected fetch/test doubles.
8. Document local setup and hardware/model caveats.

## Out Of Scope

- Shipping a bundled model.
- Requiring Ollama in CI.
- Sending browser credentials or secrets.
- Provider selection UX.
- Gateway or commercial provider adapters.

## Implementation Sequence

1. Extend provider-runtime exports with an Ollama config and factory.
2. Implement health, capability negotiation and request handling.
3. Add output extraction and validation around Learning Companion response schema.
4. Add tests for configuration, capability subset, outage, invalid JSON, cancellation/timeout and successful structured response.
5. Add setup docs and update provider-runtime README.
6. Run `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test`, and `pnpm build`.

## Handoff Boundary

Construction may begin only after Product Owner approval of this inception and developer approval for inception. Product Owner acceptance and completion remain separate governed actions.
