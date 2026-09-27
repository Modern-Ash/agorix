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
  authToken: process.env.AGORIX_GATEWAY_TOKEN,
});
```

## Commercial deployments

A hosted commercial service that speaks the OpenAI chat-completions protocol is
a **deployment**, not an architecture element. It is configured, never coded:

```bash
AGORIX_TUTOR_ADAPTER=openai-compatible
AGORIX_TUTOR_BASE_URL=https://gateway.example.com/v1   # base URL, without /chat/completions
AGORIX_TUTOR_MODEL=the-model-you-are-entitled-to-use
AGORIX_TUTOR_AUTH_TOKEN=...                            # server-side only
AGORIX_TUTOR_TIMEOUT_MS=4000
AGORIX_TUTOR_CAPABILITIES=coach
```

No vendor name, endpoint or model is compiled into the repository, no vendor is
preferred, and no vendor SDK is a dependency. Changing provider or model is a
configuration change. `apps/tutor-api` is the only component that reads these
variables; the browser never receives the token.

## Adding another adapter

1. Implement the `LearningCompanionProviderRuntime` contract in
   `packages/provider-runtime`: `descriptor`, `health`, `negotiate`, `request`.
2. Keep the descriptor provider-neutral: `runtimeId`, `providerId`, `modelId`,
   `locality`, `features`, `contextLimits`, `capabilities`. No vendor payload
   enters a domain contract.
3. Validate every provider output with `validateLearningCompanionResponse`;
   malformed output must return `invalid-response`.
4. Normalize failures to `ProviderRuntimeErrorCode` so degradation is identical
   for every adapter.
5. Reuse `negotiateCapability` and `assertProviderRuntimeConformance`, and add
   tests with an injected `fetch`; no test may require a real credential.

A protocol that is not HTTP OpenAI-compatible needs a new adapter in
`packages/provider-runtime`; it must not be reimplemented inside an app.

## Safety boundaries

- Browser code must not receive gateway secrets.
- Malformed responses return `invalid-response` and cannot mutate canonical program state.
- Unsupported capabilities fail explicitly.
- Compatible servers differ, so configure only capabilities the selected deployment can satisfy.
- Provider outage, timeout or missing configuration degrades to the deterministic
  local adapter, which returns the same response as a local run.

## Testing

Required tests use injected fetch fixtures. CI must not call external gateways or require a local server.
