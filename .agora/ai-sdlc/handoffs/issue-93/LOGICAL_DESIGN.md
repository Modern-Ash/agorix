# Issue 93 Logical Design

## Boundary

Ollama stays inside `@agorix/provider-runtime`. Domain packages and UI code continue to use provider-neutral Learning Companion request/response contracts.

## Request Flow

1. Validate `LearningCompanionRequest`.
2. Build diagnostics from the provider descriptor.
3. Negotiate the requested capability.
4. Short-circuit cancellation, timeout and unsupported capability.
5. POST to `/api/generate` with `stream: false` and `format: "json"`.
6. Parse Ollama's `response` value as JSON.
7. Validate the parsed object with `validateLearningCompanionResponse`.
8. Return success only after validation passes.

## Health Flow

The adapter checks `/api/tags`. Failure to connect or non-OK HTTP status returns an unavailable health result instead of throwing through consumer code.

## Testability

All network behavior is behind injected `fetch`, so required tests do not need a local Ollama daemon.
