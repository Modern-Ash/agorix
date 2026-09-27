# OpenAI-Compatible Gateway Provider Setup

Agorix can use OpenAI-compatible HTTP gateways through `@agorix/provider-runtime`. This is a protocol adapter for local/open inference servers, not an OpenAI product dependency.

## Compatible deployment classes

- llama.cpp or similar local servers exposing `/v1/chat/completions`.
- vLLM or other self-hosted compatible servers exposing OpenAI-style HTTP endpoints.

Other deployments may work when they provide compatible JSON chat-completion responses, but feature support varies.

## Example: local unauthenticated gateway

```ts
import { createOpenAICompatibleProviderRuntime } from "@agorix/provider-runtime";

const runtime = createOpenAICompatibleProviderRuntime({
  baseUrl: "http://127.0.0.1:8080/v1",
  modelId: "llama.cpp-local",
  capabilities: ["coach", "explainer"],
});
```

## Example: protected self-hosted gateway

```ts
const runtime = createOpenAICompatibleProviderRuntime({
  baseUrl: "https://gateway.example.test/v1",
  modelId: "vllm-served-model",
  capabilities: ["coach"],
  authToken: process.env.AG_ORIX_GATEWAY_TOKEN,
});
```

## Safety boundaries

- Browser code must not receive gateway secrets.
- Malformed responses return `invalid-response` and cannot mutate canonical program state.
- Unsupported capabilities fail explicitly.
- Compatible servers differ, so configure only capabilities the selected deployment can satisfy.

## Testing

Required tests use injected fetch fixtures. CI must not call external gateways or require a local server.
