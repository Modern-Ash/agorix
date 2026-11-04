# Ori local model preview (adult-supervised synthetic demo)

Prerequisites: Node.js 20+, local Ollama installed and running, and the selected model available locally. This demo is not child-facing and does not modify projects.

```bash
ollama pull qwen2.5:3b
ollama serve
# In another terminal, from the Ori repository:
npm run demo:local-preview -- help
npm run demo:local-preview -- debug
```

Optional: `ORI_OLLAMA_MODEL=qwen2.5:3b npm run demo:local-preview -- repeat`.

The command uses synthetic session metadata only, with no child identity, raw learner message, project or execution trace. A valid local hint reports `hintSource: "ollama"`; if Ollama is absent, slow or its response fails the output guard, it reports `hintSource: "deterministic"`. This is a smoke demo, not evidence of pedagogical efficacy or production readiness.

The local endpoint is loopback-only. No cloud provider is enabled. No automatic edits or shell tools are granted. Agorix integration work must target `integration/ori` only.
