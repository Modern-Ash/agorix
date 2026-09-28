---
schema: "agora-ai-sdlc/artifact/v1"
kind: "test-strategy"
version: 1
id: "TS-070"
work: "issue-70"
revision: 1
traces-to: ["MC-070"]
---

# Test Strategy

Deterministic checks:

- `git diff --check -- docs/product/LEARNING_PROGRESSION.md`
- Targeted grep for stage names, required dimensions, AI literacy terms, over-assistance, provider/model independence and review prompts.
