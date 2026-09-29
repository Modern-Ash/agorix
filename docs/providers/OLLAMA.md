# Ollama Local Provider Setup

Agorix can use Ollama as a local/open Learning Companion provider through `@agorix/provider-runtime`. Ollama is an adapter detail, not a domain dependency.

## Requirements

- Ollama installed and running locally.
- A model pulled into the local daemon.
- Explicit endpoint and model configuration.
- A documented capability subset such as `coach` and `explainer`.

## Example

```ts
import { createOllamaProviderRuntime } from "@agorix/provider-runtime";

const runtime = createOllamaProviderRuntime({
  endpoint: "http://127.0.0.1:11434",
  modelId: "qwen2.5-coder:7b",
  capabilities: ["coach", "explainer"],
  timeoutMs: 10_000,
});
```

## Safety boundaries

- The browser does not need a provider credential for the local path.
- Malformed model output is returned as `invalid-response` and cannot mutate the canonical program.
- Unsupported capabilities fail explicitly.
- The editor/runtime must keep working when the local daemon is unavailable.

## Testing

Required CI tests use injected fetch doubles and do not require Ollama. Optional local integration can be added or run only when a developer has Ollama available.

## Caveats

Model behavior and performance vary by hardware, model size and quantization. Do not promise universal latency, structured-output reliability or capability coverage for all Ollama models.
