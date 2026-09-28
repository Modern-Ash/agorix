# Issue 94 Intent

## Source

- GitHub issue: https://github.com/Modern-Ash/agorix/issues/94
- Parent epic: #67
- Dependency: #92 provider runtime contract
- Related predecessor: #93 Ollama local adapter

## Intent

Implement an OpenAI-compatible HTTP gateway adapter for local/open inference servers such as llama.cpp, vLLM, and compatible deployments, without introducing an OpenAI product dependency or provider-specific fields into Agorix domain code.

## Product Outcome

Agorix can interoperate with self-hosted or local OpenAI-compatible endpoints through the same Learning Companion provider-runtime contract used by fake and Ollama adapters.

## Architectural Decision

The adapter belongs behind `@agorix/provider-runtime`. Base URL, model id, optional auth, structured-output declaration, and endpoint capability assumptions stay inside the adapter configuration and tests.
