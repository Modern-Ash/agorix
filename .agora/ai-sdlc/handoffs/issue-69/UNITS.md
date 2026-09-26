---
schema: "agora-ai-sdlc/artifact/v1"
kind: "unit-of-work"
version: 1
id: "UOW-069"
work: "issue-69"
revision: 1
traces-to: ["INT-069","REQ-069"]
criteria: ["product-intent","pedagogy-model","learner-journey","content-terminology","verification-evidence"]
required-sections: ["Scope","Acceptance criteria","Dependencies","Bolts"]
---

# Unit of Work

## Scope

Single cohesive documentation unit for issue #69. The unit rewrites the product/pedagogy source of truth before later architecture implementation starts: `PRODUCT_INTENT.md`, `PEDAGOGY.md`, `LEARNER_JOURNEY.md`, and limited terminology alignment in `CONTENT_GUIDE.md`.

## Acceptance criteria

- `product-intent`: Product intent defines Agorix as AI-native, open-source, child-authored and different from Scratch plus chatbot.
- `pedagogy-model`: Pedagogy defines scaffolding, gradual release, prediction, evidence, behavior-specific feedback, anti-over-assistance and reflection.
- `learner-journey`: Learner journey documents the complete intent -> proposal -> decision -> visible code -> execution -> evidence -> debugging -> improvement -> explanation loop.
- `content-terminology`: Content guide terminology aligns where necessary without widening scope into full copy rewrite.
- `verification-evidence`: Acceptance trace and PR evidence summarize before/after definition, changed invariants, unresolved decisions and required independent review.

## Dependencies

Depends on issue #106 Wave 0 order and issue #69 source inputs: README, product docs, `docs/architecture/AI_TUTOR.md`, `AGENTS.md` and parent #63. It should complete before #70, #71 and #72 reinterpret or implement the new architecture.

## Bolts

Delivered by bolt-plan `BLP-069`. Bolts are sequential because all documentation edits share the same source-of-truth boundary.
