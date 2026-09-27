---
schema: "agora-ai-sdlc/artifact/v1"
kind: "unit-of-work"
version: 1
id: "UOW-070"
work: "issue-70"
revision: 1
traces-to: ["INT-070", "REQ-070"]
criteria: ["progression-model", "scaffolding-rubric", "ai-literacy", "verification-evidence"]
required-sections: ["Scope", "Acceptance criteria", "Dependencies", "Bolts"]
---

# Unit of Work

## Scope

Single documentation unit creating `docs/product/LEARNING_PROGRESSION.md`.

## Acceptance criteria

- `progression-model`: concept-based stages from Explore through Critique or equivalent.
- `scaffolding-rubric`: per-stage AI behavior, learner action, evidence and over-assistance.
- `ai-literacy`: explicit AI fallibility, evidence, model disagreement, privacy and learner authorship.
- `verification-evidence`: trace #70 acceptance and review challenges.

## Dependencies

Depends on #69 merged product/pedagogy/journey docs, #63 and `PROGRAMMING_MODEL.md`.

## Bolts

Delivered by `BLP-070`.
