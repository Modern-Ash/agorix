# Issue 92 Logical Design

## Boundary

The provider runtime package carries Learning Companion domain payloads without knowing vendor transports. Real adapters in #93, #94 and #95 will implement `LearningCompanionProviderRuntime`.

## Negotiation

Callers can use `negotiateCapability` or `runtime.negotiate(capability)` before sending a request. Unsupported capability and structured-output mismatch are separate machine-readable outcomes.

## Errors

Provider failures are normalized into shared error codes. Timeout, cancellation and unsupported capability are explicit, independent of provider family.

## Configuration

`ProviderModelConfig` separates provider id, model id and runtime id from domain payload schemas so model/provider selection can change through configuration.

## Security Direction

Credentials and provider SDK metadata stay behind adapter implementations. The provider-neutral package and Learning Companion domain package remain SDK-free.
