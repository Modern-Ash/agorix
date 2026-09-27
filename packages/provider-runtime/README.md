# @agorix/provider-runtime

Provider-neutral runtime and capability negotiation contract for Learning Companion adapters.

This package defines the boundary that local/open, OpenAI-compatible and optional commercial adapters implement. It deliberately contains no provider SDK dependency and no credential-bearing configuration.

## Deterministic runtime

The fake runtime remains the default for CI and local contract tests. It proves provider capability negotiation and Learning Companion response validation without requiring network services or provider credentials.

## Ollama local adapter

Issue #93 adds `createOllamaProviderRuntime` as the first local/open model adapter. Ollama stays behind the provider-runtime boundary: domain packages depend on `LearningCompanionProviderRuntime`, not Ollama concepts or SDKs.

Example configuration:

```ts
import { createOllamaProviderRuntime } from "@agorix/provider-runtime";

const runtime = createOllamaProviderRuntime({
  endpoint: "http://127.0.0.1:11434",
  modelId: "qwen2.5-coder:7b",
  capabilities: ["coach", "explainer"],
  timeoutMs: 10_000,
});
```

Capability support is declared by configuration. Do not assume every local model supports structured output or every Learning Companion role. If a requested capability is not advertised, or structured output is disabled, negotiation fails explicitly and request handling returns `unsupported-capability`.

The adapter calls Ollama over HTTP using the platform `fetch` API or an injected fetch implementation. It does not require a browser secret or network provider credential.

## Local setup notes

1. Install and start Ollama for your platform.
2. Pull a model that can reliably return JSON for the configured capability subset.
3. Configure the endpoint and model explicitly; there is no hard-coded model default.
4. Keep the deterministic fake runtime as the CI default. Real Ollama checks should be opt-in because local hardware, model size and daemon availability vary.

Local models can be slow or inconsistent on smaller machines. Treat Ollama capability declarations as model-specific, and fail closed when structured output validation fails.
