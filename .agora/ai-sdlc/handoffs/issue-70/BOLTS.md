---
schema: "agora-ai-sdlc/artifact/v1"
kind: "bolt-plan"
version: 1
id: "BLP-070"
work: "issue-70"
revision: 1
traces-to: ["UOW-070", "PLN-070"]
unit: "UOW-070"
plan: "PLN-070"
proposed-by: "project:ai-codex"
approval-state: "pending"
approved-by: null
approved-revision: null
bolts: [{"id":"progression-model","mode":"sequential","status":"proposed","tasks":["Define competency stages and dimensions","Map programming/collaboration/AI literacy capabilities"],"depends-on":[],"writes":["docs/product/LEARNING_PROGRESSION.md"],"produces":["stage-model"],"evidence":[]},{"id":"scaffolding-rubric","mode":"sequential","status":"proposed","tasks":["Define per-stage AI may/avoid rules","Define learner action/evidence/escalation/over-assistance"],"depends-on":["progression-model"],"writes":["docs/product/LEARNING_PROGRESSION.md"],"produces":["rubric"],"evidence":[]},{"id":"review-evidence","mode":"sequential","status":"proposed","tasks":["Trace acceptance criteria","Prepare independent pedagogical review prompts"],"depends-on":["scaffolding-rubric"],"writes":["docs/product/LEARNING_PROGRESSION.md"],"produces":["acceptance-trace"],"evidence":[]}]
required-sections: ["Scope", "Bolts", "Conflicts", "Approval"]
---

# Bolt Plan

## Scope

Sequential documentation bolts for `UOW-070`.

## Bolts

`progression-model` -> `scaffolding-rubric` -> `review-evidence`.

## Conflicts

Single output file; bolts are sequential.

## Approval

Approval-state: `pending` until Product Owner approval.
