# Agorix self-hosting guide

Agorix is open-source-first: the product must run without a mandatory
proprietary AI service, browser API key, or hosted backend. The deployment
ladder is:

1. deterministic System-0 before Laya/System-1;
2. Laya/System-1 before generative inference;
3. local inference before remote inference;
4. remote providers only when a deployment explicitly enables them.

Companion references:

- [Provider matrix](../evidence/PROVIDER_MATRIX.md)
- [Privacy threat model](../safety/PRIVACY_THREAT_MODEL.md)
- [Ollama local provider](../providers/OLLAMA.md)
- [OpenAI-compatible gateway](../providers/OPENAI_COMPATIBLE_GATEWAY.md)
- [Learning Decision Plane](../../packages/learning-decision-plane/README.md)

## Fresh checkout

```bash
git clone https://github.com/Modern-Ash/agorix.git
cd agorix
corepack enable
pnpm install --frozen-lockfile
pnpm verify
```

`pnpm verify` runs install verification, lint, tests, build, and the security
baseline. It does not require Ollama, Laya, a gateway, or remote credentials.

## Mode 1: public static demo, zero AI infrastructure

This mode is for a public/static Web or PWA deployment where the app must not
need API keys, server secrets, or a backend service.

```text
Browser Web/PWA
  -> System-0 deterministic pedagogical and safety rules
  -> deterministic/fallback Learning Companion response
  -> browser-local persistence
```

Build and preview:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @agorix/web build
pnpm --filter @agorix/web preview -- --host 127.0.0.1
```

Developer mode:

```bash
pnpm --filter @agorix/web dev -- --host 127.0.0.1
```

Operational rules:

- Do not set any `AGORIX_TUTOR_*` provider variables for this mode.
- Do not run `apps/tutor-api`; the static app is the deployment artifact.
- Browser storage is local to the device. No Learning Companion provider
  request leaves the machine.
- Deterministic/fallback behavior must remain useful when offline or when no
  model process exists.

The static host may serve `apps/web/dist` after the build. If the host supports
header files, keep the generated `apps/web/public/_headers` equivalent to the
tested security header source.

## Mode 2: local intelligent path with Laya/System-1

This mode adds a local advisory decision process without adding a generative
model requirement.

```text
Browser or local app surface
  -> System-0 deterministic floors
  -> local Laya/System-1 transport
  -> LearningRequirements
  -> deterministic response unless requirements permit a provider
```

The repository boundary is intentionally small:

- `packages/learning-decision-plane/src/laya.ts` accepts an injected
  `LayaBatchTransport`.
- The transport receives only compact decision state and bounded choice
  questions.
- The domain package does not depend on Python, HTTP, browser bridges, Ollama,
  or any provider SDK.

The compact state sent to Laya is:

```text
capability
scaffoldLevel
scaffoldHistoryLength
hasLearnerIntent
hasRuntime
runtimeFactCount
selectedNodeCount
offline
explicitStrongerHelpRequested
```

Raw learner free text must not be sent to Laya's Decision Plane. If a future
surface collects a learner question, keep that content outside the
`LearningDecisionState` compact state and outside Laya transport payloads.

Local setup for this mode is deployment-specific because Laya is injected as a
transport, not launched by this package:

1. Run the Laya process or library on the same machine or trusted local network.
2. Implement `LayaBatchTransport.decideMany` at the app boundary.
3. Return only allowed choice values with confidence scores.
4. Treat low confidence, invalid choices, or process errors as abstentions.
5. Keep System-0 floors authoritative; Laya cannot raise solution allowance
   above deterministic policy.

This mode has no model weight license requirement unless the selected Laya
deployment adds one.

## Mode 3: local generative path with zero service cost

This mode keeps inference local while allowing generative assistance after
`LearningRequirements` says a provider is needed.

```text
Agorix
  -> System-0
  -> optional local Laya/System-1
  -> LearningRequirements
  -> local provider-runtime adapter
  -> Ollama or compatible local gateway
```

Ollama-native adapter example:

```ts
import { createOllamaProviderRuntime } from "@agorix/provider-runtime";

const runtime = createOllamaProviderRuntime({
  endpoint: "http://127.0.0.1:11434",
  modelId: "qwen2.5-coder:7b",
  capabilities: ["coach", "explainer"],
  timeoutMs: 10_000,
});
```

OpenAI-compatible local gateway example:

```bash
AGORIX_TUTOR_ADAPTER=openai-compatible
AGORIX_TUTOR_BASE_URL=http://127.0.0.1:8080/v1
AGORIX_TUTOR_MODEL=local-compatible-model
AGORIX_TUTOR_TIMEOUT_MS=10000
AGORIX_TUTOR_CAPABILITIES=coach,explainer
```

Do not set `AGORIX_TUTOR_AUTH_TOKEN` for an unauthenticated localhost gateway.
If a local gateway requires auth, set the token only in the server environment;
never expose it to the browser bundle.

Local-only safety rules:

- Configure only local endpoints such as `127.0.0.1`, `localhost`, or a trusted
  LAN host you control.
- Do not configure a remote base URL as a fallback.
- Capability negotiation must fail closed when a local model cannot satisfy the
  requested role.
- Malformed provider output must stay behind
  `validateLearningCompanionResponse` and degrade to deterministic/fallback
  behavior.

Hardware expectations:

- Small CPU-only machines can run the static demo and deterministic/Laya modes.
- Local generative models may be slow on CPU-only hardware.
- Larger quantized models usually need more RAM and may need GPU acceleration
  for acceptable latency.
- Model quality, JSON reliability, latency, and license terms vary by model and
  quantization. Record live observations separately from CI conformance.

## Mode 4: optional remote provider

Remote inference is a deployment choice, never a requirement.

```text
Browser
  -> self-hosted tutor-api
  -> server-side provider-runtime adapter
  -> explicitly allowed remote gateway/provider
```

Server-side configuration pattern:

```bash
AGORIX_TUTOR_ADAPTER=openai-compatible
AGORIX_TUTOR_BASE_URL=https://gateway.example.com/v1
AGORIX_TUTOR_MODEL=deployment-approved-model
AGORIX_TUTOR_AUTH_TOKEN=<server-side-token>
AGORIX_TUTOR_TIMEOUT_MS=4000
AGORIX_TUTOR_CAPABILITIES=coach
```

The browser must never receive `AGORIX_TUTOR_AUTH_TOKEN` or any provider API
key. `apps/tutor-api` reads provider configuration server-side, strips
`learnerIntent` by default, validates provider output, and degrades to the
deterministic adapter if configuration is missing or the provider fails.

Data leaving the machine in this mode can include structured program context
and runtime observations. Raw learner free text remains disabled unless the
server operator explicitly sets `AGORIX_TUTOR_INCLUDE_LEARNER_QUESTION=1` after
reviewing the privacy impact.

## License boundaries

The Agorix source tree is licensed under Apache-2.0 unless a file says
otherwise. That source license does not automatically license:

- model weights;
- tokenizer files;
- datasets;
- third-party assets;
- hosted inference services;
- provider trademarks;
- school or family deployment policies.

Adapter source, gateway software, model weights, and hosted service terms are
separate legal objects. A school or family self-hosting Agorix must verify the
license and acceptable-use terms for the exact model or service they choose.

## Updates and troubleshooting

Update from source:

```bash
git pull --ff-only
corepack enable
pnpm install --frozen-lockfile
pnpm verify
pnpm --filter @agorix/web build
```

Common checks:

- Static demo asks for a token: remove `AGORIX_TUTOR_*` variables from the
  static deployment and rebuild.
- Local gateway silently calls a remote URL: inspect `AGORIX_TUTOR_BASE_URL`
  and fail deployment if it is not a local/trusted endpoint.
- Laya changes final authority: reject the integration. System-0 floors and
  learner acceptance remain authoritative.
- Ollama is unavailable: keep deterministic/fallback behavior and check the
  local daemon separately.
- Model output is malformed: reduce advertised capabilities or switch model;
  do not bypass schema validation.
