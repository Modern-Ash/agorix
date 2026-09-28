# Issue 93 Suggested Bolts

## Bolt 1: Ollama Runtime Factory

Add configuration types and `createOllamaProviderRuntime` behind `@agorix/provider-runtime`.

## Bolt 2: Capability And Health

Implement descriptor, configured capability subset, negotiation and daemon health check.

## Bolt 3: Request/Response Boundary

Translate Learning Companion requests into an Ollama request, then parse and validate structured output before returning success.

## Bolt 4: Failure Semantics

Normalize unsupported capability, unavailable daemon, timeout, cancellation, invalid response and provider failure.

## Bolt 5: Deterministic Tests

Use injected fetch/test doubles so CI remains independent of local Ollama.

## Bolt 6: Local Setup Guide

Document endpoint/model configuration, optional integration command and hardware/model caveats.
