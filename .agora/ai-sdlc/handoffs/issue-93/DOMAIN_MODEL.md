# Issue 93 Domain Model

## Provider Runtime

The Ollama adapter implements `LearningCompanionProviderRuntime` from `@agorix/provider-runtime`.

## Ollama Runtime Config

`OllamaProviderRuntimeConfig` contains:

- `endpoint`: explicit local daemon URL.
- `modelId`: explicit Ollama model name.
- `runtimeId`: optional runtime identity, defaulting to `ollama:<modelId>`.
- `capabilities`: declared Learning Companion capability subset.
- `structuredOutput`: whether the selected model is configured for structured JSON.
- `timeoutMs`: optional default timeout.
- `fetch`: injectable fetch implementation for deterministic tests.

## Runtime Descriptor

The descriptor advertises provider `ollama`, locality `local`, configured model identity, structured output support, context limits, and per-capability descriptors.

## Failure Model

The adapter returns provider-runtime failures for unsupported capability, timeout, cancellation, provider unavailable, provider error and invalid response. Malformed model output is classified as `invalid-response`.
