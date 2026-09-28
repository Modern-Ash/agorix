# Issue 92 User Stories

## US-001 Provider-Neutral Runtime Contract

As an adapter implementer, I can implement local or remote providers through the same runtime interface without adding vendor SDKs to domain contracts.

Acceptance link: domain contracts compile without vendor SDKs; local and remote adapters use same interface.

## US-002 Capability Negotiation

As the Learning Companion orchestration layer, I can ask a runtime what capabilities it supports before sending a request.

Acceptance link: capability mismatch is explicit.

## US-003 Fake Adapter Coverage

As a developer, I can run conformance tests against at least two fake adapters with different capability sets so later real providers have a stable target.

Acceptance link: at least two fake adapters with different capability sets pass tests.

## US-004 Normalized Failure Handling

As an app surface, I receive normalized timeout, cancellation, configuration, unsupported capability and provider failure errors independent of provider family.

Acceptance link: timeout/cancel/error behavior normalized.

## US-005 Configurable Provider And Model

As an operator or developer, I can switch provider/model configuration without changing canonical program, curriculum, runtime or Learning Companion domain contracts.

Acceptance link: provider/model can be changed through configuration.

## US-006 Safe Dependency Direction

As a reviewer, I can see architecture documentation proving browser/client code and domain packages do not receive provider secrets or provider-specific metadata.

Acceptance link: architecture documents dependency direction.
