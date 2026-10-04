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

## Studio (VS Code) path

Agorix Studio never talks to Ollama directly. It talks to the tutor API / adapter boundary, which hosts the Ollama runtime server-side. The extension holds no provider SDK and no embedded credentials.

```text
Studio (extensions/vscode)  --HTTP-->  tutor API boundary  --adapter-->  Ollama (127.0.0.1:11434)
   GET  {endpoint}/health      -> { "status": "available" | "degraded" | "unavailable" }
   POST {endpoint}/companion   -> LearningCompanionRequest in, LearningCompanionResponse out
```

### Settings (`agorixStudio.agent.*`)

| Setting                              | Default     | Meaning                                                                           |
| ------------------------------------ | ----------- | --------------------------------------------------------------------------------- |
| `enabled`                            | `true`      | Master switch. Off means state `disabled`; nothing is contacted.                  |
| `endpoint`                           | empty       | Boundary URL, for example `http://127.0.0.1:8787`. Loopback hosts count as local. |
| `remoteEndpoint`                     | empty       | Optional non-local boundary. Contacted only when `allowRemote` is on.             |
| `preferLocal`                        | `true`      | Local endpoints are tried before remote ones.                                     |
| `allowRemote`                        | `false`     | Explicit opt-in for any non-loopback endpoint.                                    |
| `healthTimeoutMs`/`requestTimeoutMs` | 1500 / 8000 | Probe and request timeouts.                                                       |

### Credentials

The local Ollama path needs none. If a deployment's boundary requires one, run `Agorix Studio: Set Agent Credential`. It is stored only in VS Code SecretStorage, read at call time, sent only as a bearer header over HTTPS or loopback, and never written to settings, logs or fixtures.

### Agent state

The status bar item shows `ready`, `unavailable` or `off` (`available` / `unavailable` / `disabled`), driven by `checkProviderRuntimeHealth` and `describeProviderUnavailableForLearner`. Learner copy never names providers or endpoints. Editing, running, canvas and missions are unaffected in every state.

### Validation

Every response passes `validateLearningCompanionSafety` (schema, capability match, scaffolding, PII, hidden actions, proposal freshness, evidence provenance) before leaving the client. Rejected output yields only the child-safe message; the program is unchanged.

### Manual smoke test

1. `ollama serve` and `ollama pull qwen2.5-coder:7b`.
2. Run a tutor API boundary that wraps `createOllamaProviderRuntime` as above and serves the two routes.
3. Set `agorixStudio.agent.endpoint` to its URL; run `Agorix Studio: Check Agent Availability` and expect `ready`.
4. Stop Ollama and re-check: expect `unavailable`, with editing and running still working.

CI uses an in-process loopback boundary backed by the deterministic fake runtime (`extensions/vscode/src/studioProvider.test.ts`) and needs no Ollama or credentials. The manual smoke test above has not been executed in CI.
