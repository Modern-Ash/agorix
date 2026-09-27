# Issue 94 Domain Model

## OpenAI-Compatible Gateway Runtime

The gateway adapter implements `LearningCompanionProviderRuntime` behind `@agorix/provider-runtime`.

## Config

`OpenAICompatibleProviderRuntimeConfig` contains explicit `baseUrl`, `modelId`, optional `runtimeId`, declared `capabilities`, `structuredOutput`, optional `authToken`/`authHeaderName`, timeout and injectable `fetch`.

## Descriptor

The descriptor advertises provider `openai-compatible`, configured model identity, local locality when unauthenticated and remote locality when auth is configured, plus configured capability descriptors.

## Failure Model

Unsupported capability, timeout, cancellation, authentication failure, provider unavailable, provider error and invalid response return normalized provider-runtime failures.
