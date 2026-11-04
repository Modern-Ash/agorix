# First executable Ori harness (Agorix defaults)

This branch implements a **provider-free, headless, deterministic baseline**, not yet a full Codex/Claude-like coding agent.

## Run
Requires Node.js >=20. No npm install, credentials, API keys, browser or paid tokens.

```bash
npm test
npm run check
npm run demo
```

## Included now
- Agorix Kids profile (`es-AR`) and scoped read-only tools.
- Default three-step learning plans for movement, turning, repetition, help and debugging.
- Graduated hints that do not disclose the solution at mission start.
- One-block **optional** proposals for move/turn only after at least one attempt and two hints, explicit `allowProposal` and a host-advertised allowlist. They are never applied by Ori.
- Trace-grounded debugging prompt and deterministic fallback without any LLM.
- Basic safety/PII pattern checks and synthetic tests.

## Not included
No provider adapters, LLM reasoning, persistent memory, API server, Agorix runtime adapter or production-grade child-safety filter. This prototype **must not be exposed directly to children** before #23/#24 and end-to-end validation. The host must independently validate proposals, authenticate grants and control edits.

## Contract status
`ori/proposal/v0` is a provisional local shape; it is **not** the normative `ori/session/v1` schema from #7. No cross-host compatibility claim yet.

## Next steps
#7 normative contracts; #23 threat model; #15 tool grants; #11 provider interface; #28 Agorix adapter. Then add multi-LLM provider(s) with identical deterministic regression tests.

## Multi-LLM port (second increment)
The new `src/providers.mjs` exposes a provider-agnostic router. Adapters are injected and can be tested with fakes. Selection follows a preferred list, validates bounded text responses, aborts timed-out requests and falls back deterministically. No real OpenAI, Anthropic or Ollama HTTP adapter has been implemented yet.

The harness can opt into provider hints with `createOriHarness(tools, { enableProvider: true, providerRouter })`. **Raw learner text is not passed to the provider**: only intent and non-identifying learning counters. The provider output is currently a short hint, not a plan, tool call or diff. This is not a production-safe content validator.

## Synthetic Agorix seam
`src/agorix-adapter.mjs` maps host `readProgram` and optional `readTrace` to the scoped Ori tools. This is a demonstration adapter, not yet connected to the actual Agorix runtime or API.

## Safety limitation
Do not enable external providers for children until output moderation, provider trust/privacy review, data flow audit, strict schemas and threat model (#23/#24) are complete. No keys, provider SDKs or HTTP calls are bundled in this increment.

## Optional Ollama localhost demo (fourth increment)
`src/ollama.mjs` implements a localhost-only HTTP adapter for Ollama's `/api/chat` endpoint. It rejects remote addresses, credentials and URL paths; the payload contains only classified intent and counters, not raw child messages or program content. It is an **experimental, opt-in adapter**, not yet approved for child-facing production use.

With Ollama already installed, running locally and a compatible model available:

```bash
ollama pull qwen2.5:3b
npm run demo:ollama
```

Set `ORI_OLLAMA_MODEL` to select another installed model. If Ollama is unavailable or times out, the router falls back to the deterministic hint. The demo does not require cloud tokens.

**Important:** Model-generated text is not yet covered by a complete child-safety output validator. Do not expose the Ollama path directly to children until #23/#24 and independent adversarial evaluations are completed. The adapter currently accepts only `learningStage: connect` and a limited intent vocabulary.

## Fifth increment: conservative model-output guard
`src/output-guard.mjs` is a fail-closed heuristic gate for short Spanish Socratic questions. It rejects obvious code, spoilers, personal-data requests, links, invented execution claims and multi-line output. Rejected text is replaced by the deterministic Agorix hint. Unit tests cover both accepted and rejected examples.

**This is defense in depth, not a production-grade child-safety system.** Heuristic filters can miss unsafe content and incorrectly reject benign responses. Production use still requires threat modeling (#23), stronger policy enforcement and independent evaluation (#24/#25). The host remains responsible for consent, program validation and safeguarding.

## Canonical Agorix bridge (next increment)
`src/agorix-runtime-bridge.mjs` now recognizes the actual Agorix `agorix/program/v1` schema and the `RunResult.trace` shape. It maps runtime step numbers and statement types to minimized read-only evidence, deliberately dropping world state, paths and actor IDs.

**Important limitation:** this is still a boundary library tested with synthetic objects matching Agorix's source types, not a wired production integration. Ori v0 `turn` proposals use left/right, whereas Agorix canonical `turn` uses degrees; therefore the bridge only advertises `move` proposals until contract parity is implemented. The Agorix host must validate all programs and diffs with its own program-model before applying changes.

Source-of-truth inspected: `Modern-Ash/agorix/packages/program-model/src/schema.ts` and `packages/runtime/src/execute.ts`. This bridge is intentionally read-only.

## Canonical preview translation
`src/agorix-proposals.mjs` translates the provisional Ori `move` and `turn` proposal blocks to Agorix canonical statements (`{type:"move",steps}` and `{type:"turn",degrees}`). Right is +90 degrees, left is -90 degrees. It returns a **review-only preview**, not a mutated program, and always requires learner approval.

This is a narrow semantic mapping, **not** a completed Agorix runtime integration. The host must validate the resulting full `agorix/program/v1` with its own `validateProgram`, determine target script and insertion point, present the preview and obtain learner approval. The existing bridge continues to advertise only `move` until host-side end-to-end validation supports turns. No direct write capability is added to Ori.
