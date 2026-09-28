# Issue 94 Logical Design

## Boundary

The adapter is a protocol adapter, not an OpenAI product dependency. Domain packages consume only provider-neutral Learning Companion contracts.

## Request Flow

1. Validate `LearningCompanionRequest`.
2. Negotiate the requested capability.
3. Short-circuit cancellation, timeout and unsupported capability.
4. POST to `<baseUrl>/chat/completions` with configured model, JSON response format and messages.
5. Include optional auth header only when configured.
6. Parse `choices[0].message.content` as JSON.
7. Validate with `validateLearningCompanionResponse` before success.

## Health Flow

Health checks `<baseUrl>/models` and reports unavailable instead of throwing through consumers.
