# ADR 0005: Provider Runtime Contract

## Status

Accepted for issue #92 construction.

## Context

Issue #85 introduced provider-neutral Learning Companion request and response contracts. The next dependency for local/open and remote model support is the runtime boundary: Agorix needs to know which configured provider/model supports which Learning Companion capabilities, how structured output is transported, and how timeout/cancel/error behavior is normalized.

## Decision

Add `@agorix/provider-runtime` as a provider-neutral TypeScript contract package. It depends on `@agorix/tutor-contract` for Learning Companion payloads and deliberately contains no vendor SDKs or credential-bearing configuration.

The package defines:

- provider/runtime/model identity;
- local vs remote locality;
- structured JSON, streaming and tool-calling capability flags;
- context/token limits;
- Learning Companion capability descriptors;
- capability negotiation result;
- health/availability model;
- normalized timeout, cancellation, unsupported capability, configuration, authentication, provider failure and invalid-response errors;
- deterministic fake local and remote-style runtimes for conformance tests.

## Consequences

- Ollama, OpenAI-compatible and optional commercial adapters can target one interface in later issues.
- Capability mismatch is explicit before request transport.
- Provider-specific metadata and SDK types stay behind adapter implementations.
- Browser/client code and domain packages remain free of provider secrets.
