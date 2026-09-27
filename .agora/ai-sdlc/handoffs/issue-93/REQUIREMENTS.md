# Issue 93 Requirements

## Functional Requirements

1. Provide an Ollama-backed implementation of `LearningCompanionProviderRuntime`.
2. Configure Ollama endpoint and model name without hard-coded model defaults.
3. Declare capabilities from adapter/model configuration rather than assuming every Ollama model supports every Learning Companion role.
4. Implement a health or availability check for the local daemon.
5. Support timeout and cancellation through provider runtime request options.
6. Validate structured model output before returning a successful Learning Companion response.
7. Return explicit provider runtime failures for unsupported capability, timeout, cancellation, unavailable daemon, malformed output and provider failure.
8. Keep deterministic fake provider behavior as the default path for CI.
9. Add local setup documentation, including hardware/model caveats.

## Acceptance Trace

- Local Ollama can serve a documented subset such as `coach` and `explainer`.
- Model name and endpoint are configuration.
- Provider outage is isolated from editor/runtime health.
- Malformed model output cannot mutate the canonical program.
- No network credential is required for the local path.
- Optional integration tests are skipped or gated when Ollama is absent.
- Setup docs avoid promising universal local-model performance.

## Out Of Scope

- OpenAI-compatible gateway adapter (#94).
- Commercial provider migration (#95).
- Product-level provider selection/fallback UI (#96).
- Full multi-provider conformance matrix (#97).
