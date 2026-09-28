---
schema: "agora-ai-sdlc/artifact/v1"
kind: "logical-design"
version: 1
id: "LD-069"
work: "issue-69"
revision: 1
traces-to: ["PLN-069", "UOW-069"]
---

# Logical Design

## Document design

- PRODUCT_INTENT.md defines the north star, promise, differentiators, invariants, non-goals and unresolved decisions.
- PEDAGOGY.md defines scaffolding, gradual release, learner loop, proposal/accepted/executed distinction, prediction, feedback, anti-over-assistance and reflection.
- LEARNER_JOURNEY.md turns those concepts into the end-to-end product flow.
- CONTENT_GUIDE.md receives only terminology changes needed to avoid the narrow tutor-only model.

## Construction boundary

The implementation is documentation-only. It does not change UI, runtime, package APIs, providers or data persistence.
