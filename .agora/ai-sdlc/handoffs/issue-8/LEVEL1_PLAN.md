---
schema: "agora-ai-sdlc/artifact/v1"
kind: "plan"
version: 1
id: "PLN-008"
work: "issue-8"
revision: 1
traces-to: ["INT-008", "UOW-008"]
level: 1
parent-plan: null
intent: "INT-008"
unit: "UOW-008"
proposed-by: "project:ai-primary"
approval-state: "approved"
approved-by: "project:product-owner"
approved-revision: 1
steps:
  - id: "clarify-intent"
    decision: "execute"
    rationale: "Confirm material decisions D1-D8; they are Product-Owner-owned judgement calls, not AI facts."
    dependencies: []
    required-artifacts: ["intent"]
    produced-artifacts: []
  - id: "elaborate-stories"
    decision: "execute"
    rationale: "Validate the draft LEARNER_JOURNEY.md against PRODUCT_INTENT, MVP, PEDAGOGY, AGENTS and the dual-surface invariant."
    dependencies: ["clarify-intent"]
    required-artifacts: ["intent"]
    produced-artifacts: ["docs/product/LEARNER_JOURNEY.md"]
  - id: "assess-risks"
    decision: "execute"
    rationale: "Record risks, constraints and dependencies from the bounded product/architecture context."
    dependencies: ["clarify-intent"]
    required-artifacts: []
    produced-artifacts: []
  - id: "decompose-units"
    decision: "execute"
    rationale: "Split the intent into cohesive documentation slices as unit-of-work criteria."
    dependencies: ["clarify-intent", "elaborate-stories"]
    required-artifacts: ["intent"]
    produced-artifacts: ["unit-of-work"]
  - id: "measurement-criteria"
    decision: "execute"
    rationale: "Trace issue #8 acceptance criteria to concrete document sections so implementation needs no guessing."
    dependencies: ["elaborate-stories"]
    required-artifacts: []
    produced-artifacts: ["docs/product/LEARNER_JOURNEY.md"]
  - id: "implementation"
    decision: "execute"
    rationale: "Tighten the document per the confirmed decisions. The deliverable stays documentation only; no product code."
    dependencies: ["clarify-intent", "elaborate-stories", "assess-risks", "decompose-units", "measurement-criteria"]
    required-artifacts: ["unit-of-work"]
    produced-artifacts: ["docs/product/LEARNER_JOURNEY.md"]
required-sections: ["Scope", "Level and parent", "Steps", "Approval"]
---

# Plan

## Scope

Intent INT-008 / Unit UOW-008. Documentation deliverable: `docs/product/LEARNER_JOURNEY.md` (POC learner journey and editor information architecture). No React component or product code is in scope (issue #8 "Agent handoff").

## Level and parent

Level 1 plan. No parent plan (`parent-plan: null`). It authorizes the Validation units and the final product artifact only as a Construction-stage deliverable after Product Owner approval of this plan and of the material decisions card D1-D8.

## Steps

`clarify-intent` → `elaborate-stories` → `assess-risks` → `decompose-units` → `measurement-criteria` → `implementation`. All steps are `execute`; the ordered steps are declared in the frontmatter `steps` list with rationale, dependencies, and required/produced artifact references.

## Approval

Approval-state: `approved`. Approved by `project:product-owner` in the current interaction, revision 1 (matches `revision`). The material decisions card D1-D8 was confirmed by the same human in the same interaction and is recorded as a product decision inside `docs/product/LEARNER_JOURNEY.md` (decision provenance), not as a first-class Agora/Core decision record (agora-ai-sdlc #155 still pending).