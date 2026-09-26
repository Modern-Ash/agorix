---
schema: "agora-ai-sdlc/artifact/v1"
kind: "test-strategy"
version: 1
id: "TS-069"
work: "issue-69"
revision: 1
traces-to: ["MC-069"]
---

# Test Strategy

## Deterministic checks

- `git diff --check -- docs/product/PRODUCT_INTENT.md docs/product/PEDAGOGY.md docs/product/LEARNER_JOURNEY.md docs/product/CONTENT_GUIDE.md`
- `rg -n "AI proposes|Nothing happens|proposal|accepted program|executed result|Runtime evidence|runtime.*authority|hidden|reflection|learning companion|stuck" docs/product/PRODUCT_INTENT.md docs/product/PEDAGOGY.md docs/product/LEARNER_JOURNEY.md docs/product/CONTENT_GUIDE.md`

## Review checks

- Confirm the documents no longer define AI primarily as optional stuck-path help.
- Confirm learner agency is expressed as observable proposal/decision/result states.
- Confirm runtime evidence remains objective authority.
- Confirm unresolved decisions are explicit.
