# Issue 94 Suggested Bolts

## Bolt 1: Gateway Runtime Factory

Add config types and `createOpenAICompatibleProviderRuntime`.

## Bolt 2: Optional Auth And Base URL

Support explicit base URL, model id and optional auth header/token.

## Bolt 3: Protocol Request Boundary

Translate Learning Companion requests into compatible chat/completions requests and parse response content.

## Bolt 4: Failure Semantics

Normalize timeout, cancellation, auth failure, unavailable provider, provider error, invalid response and unsupported capability.

## Bolt 5: Deterministic Tests

Use injected fetch fixtures for local and protected compatible deployment classes.

## Bolt 6: Setup Docs

Document llama.cpp/vLLM-style compatible endpoints and caveats.
