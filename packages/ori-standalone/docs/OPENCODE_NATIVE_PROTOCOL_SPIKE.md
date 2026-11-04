# Native OpenCode interoperability — protocol spike (#13)

## Goal
Establish a **verified** integration route for the actual OpenCode runtime, without conflating its CLI/server APIs with the experimental OpenAI-compatible gateway in `src/opencode-compatible.mjs`.

## Existing state
- Ollama adapter: `src/ollama.mjs`
- Experimental compatible gateway: `src/opencode-compatible.mjs`
- Two-provider synthetic preview: `src/dual-local-preview.mjs`
- Host grants, planner and bounded loop: `src/context-builder.mjs`, `src/planner-v1.mjs`, `src/agent-loop-v1.mjs`

## Verification required before native implementation
1. Pin an OpenCode release/version and inspect its official documented local server/SDK protocol.
2. Record actual supported endpoints, request/response shapes, session lifecycle, authentication, streaming and cancellation.
3. Confirm loopback-only binding and explicit local process ownership.
4. Define a minimal `complete(metadata, {signal})` adapter that sends no raw learner text, project contents or trace data.
5. Use mocked protocol contract tests plus an opt-in local smoke test against the pinned OpenCode version.
6. Keep all outputs behind `validatePedagogicalHint` and deterministic fallback; never grant shell/filesystem/network through the Kids profile.
7. Compare provider behavior, latency and failure modes without claiming child-facing readiness.

## Acceptance gates
- A reproducible local setup and exact protocol fixture from a pinned OpenCode version.
- Negative tests for unsupported endpoints, malformed responses, cancellation, prompt injection and unauthorized capabilities.
- No reliance on an undocumented `/v1/chat/completions` endpoint.
- No child-facing deployment, no automatic program edits.
- CI green and human review.

## Branch policy
All Agorix integration changes must target `integration/ori` exclusively; no Agorix `main` or `develop` merges.
