# Issue 92 Non-Functional Requirements

## Provider Neutrality

The contract must not reference OpenAI, Anthropic, Ollama or any vendor-specific SDK type in shared domain or runtime contract code.

## Security

Provider credentials must remain outside browser bundles and outside domain packages. Request minimization from #85 must remain enforceable above the provider layer.

## Privacy

No raw child free text should be logged by default. Provider-specific metadata must remain isolated behind the adapter boundary.

## Reliability

Timeout and cancellation must be explicit and normalized so UI/runtime callers can degrade gracefully.

## Extensibility

Real adapters from #93, #94 and #95 should be able to implement the interface without changing Learning Companion domain schemas.

## Testability

Fake adapters must be deterministic and fast enough for unit/conformance tests.
