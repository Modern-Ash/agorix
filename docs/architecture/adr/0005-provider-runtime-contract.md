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

## Addendum (issue #96): capability-aware selection and offline mode

`selectProviderRuntime` (in `selection.ts`) picks the first runtime, from an
explicit ordered `preferredOrder` allowlist, that both negotiates the
requested capability and is not known-unavailable. It is a pure, synchronous
function over a precomputed `health` map so it stays table-testable — live
health probing is the separate, async `checkProviderRuntimeHealth` helper.

Offline mode is a first-class selection outcome, not an error path bolted
on afterward: `config.offline: true` always yields
`{ status: "unavailable", reason: "offline-mode" }` without touching any
runtime, so the deterministic runtime/canonical program path is guaranteed
unaffected. An `allowRemote: false` config additionally lets a host restrict
selection to local-only runtimes (e.g. a privacy-conscious deployment)
without disabling AI help entirely when a local adapter is configured.

`describeProviderUnavailableForLearner(reason, locale)` produces the
child-facing copy for any unavailable outcome — no provider/runtime/model
name, always reassures that building and running the program still works.
Developer-facing diagnostics (`descriptor`/`attempts` on the selection
outcome) are kept separate from this copy, matching the existing
`ProviderRuntimeDiagnostics` split between human/child-safe and
developer-facing information.
