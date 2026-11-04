# Ori local agent runtime — vertical slice

This milestone composes **host context → pedagogical plan → authorized read-only host tools → evidence-based refinement → local model hint → guarded response**.

## CLI
```bash
npm test
npm run check
npm run demo:agent-runtime -- help
# Opt-in Ollama, running locally with the model already downloaded:
ORI_LOCAL_MODELS=1 npm run demo:agent-runtime -- debug
```

The CLI uses synthetic context and intentionally enables only Ollama. Native OpenCode is available through `runLocalAgentRuntime` only when the caller supplies a pinned-version preflight, independent isolation attestation and a restrictive effective config verified at runtime. These flags are not proof of isolation.

## Acceptance criteria
- Deterministic default without model calls.
- Ollama hint generation with output guard.
- Native OpenCode session behind preflight and runtime permission probe.
- Safe provider fallback when a model is unavailable or generates unsafe text.
- No automatic project modifications, shell grants, or child-facing deployment.
- Contract and synthetic integration tests green.
- Actual isolated OpenCode E2E evidence remains a separate operational gate.

## Follow-up
The remaining large milestones are (a) reproducible isolated OpenCode E2E with operator evidence, (b) Agorix adapter E2E on `integration/ori` exclusively, (c) adaptive tool-using agent behavior and educator review. Do not merge Agorix integration into `main` or `develop`.
