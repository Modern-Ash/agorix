# Issue 92 Domain Model

## Package

`@agorix/provider-runtime` defines the provider-neutral runtime boundary for Learning Companion providers. It depends on `@agorix/tutor-contract` for Learning Companion request/response payloads and contains no vendor SDK dependency.

## Core Types

- `ProviderRuntimeDescriptor`: runtime id, provider id, model id, local/remote locality, feature flags, context limits and capability descriptors.
- `ProviderCapabilityDescriptor`: Learning Companion capability support plus structured-output, streaming, tool-calling and context-limit metadata.
- `CapabilityNegotiationResult`: explicit supported/missing result with reason codes.
- `ProviderRuntimeResult`: success/failure union with normalized diagnostics.
- `ProviderRuntimeError`: shared timeout, cancellation, unsupported capability, configuration, authentication, provider failure and invalid-response taxonomy.
- `LearningCompanionProviderRuntime`: shared interface for local and remote adapters.

## Fake Adapters

`createFakeProviderRuntime` produces deterministic local or remote-style adapters with configurable capability sets and failure modes for conformance tests.
