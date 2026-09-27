---
schema: "agora-ai-sdlc/artifact/v1"
kind: "plan"
version: 1
id: "PLN-069"
work: "issue-69"
revision: 1
traces-to: ["INT-069","UOW-069"]
level: 1
parent-plan: null
intent: "INT-069"
unit: "UOW-069"
proposed-by: "project:ai-codex"
approval-state: "pending"
approved-by: null
approved-revision: null
steps: [{"id":"source-fact-review","decision":"execute","rationale":"Read #69, #106 and referenced product/architecture source docs before changing documents.","dependencies":[],"required-artifacts":["intent"],"produced-artifacts":["requirements","user-stories","nfr","measurement-criteria","risk-register"]},{"id":"rewrite-product-intent","decision":"execute","rationale":"Make the product promise and differentiators AI-native, transparent and learner-authored.","dependencies":["source-fact-review"],"required-artifacts":["requirements"],"produced-artifacts":["docs/product/PRODUCT_INTENT.md"]},{"id":"rewrite-pedagogy","decision":"execute","rationale":"Define scaffolding, gradual release, prediction, evidence-based feedback, anti-over-assistance and reflection.","dependencies":["source-fact-review","rewrite-product-intent"],"required-artifacts":["requirements"],"produced-artifacts":["docs/product/PEDAGOGY.md"]},{"id":"rewrite-learner-journey","decision":"execute","rationale":"Document the complete learner loop from intent through proposal, decision, visible code, execution evidence, debugging and explanation.","dependencies":["rewrite-product-intent","rewrite-pedagogy"],"required-artifacts":["requirements"],"produced-artifacts":["docs/product/LEARNER_JOURNEY.md"]},{"id":"align-content-terminology","decision":"execute","rationale":"Adjust narrow tutor wording only where it conflicts with the learning-companion model, preserving child-facing constraints.","dependencies":["rewrite-product-intent","rewrite-pedagogy","rewrite-learner-journey"],"required-artifacts":["requirements"],"produced-artifacts":["docs/product/CONTENT_GUIDE.md"]},{"id":"verify-and-summarize","decision":"execute","rationale":"Check acceptance trace, document unresolved decisions, and prepare PR evidence for review.","dependencies":["align-content-terminology"],"required-artifacts":["measurement-criteria","risk-register"],"produced-artifacts":["acceptance-trace","pr-evidence-summary"]}]
required-sections: ["Scope","Level and parent","Steps","Approval"]
---

# Plan

## Scope

Intent `INT-069` / Unit `UOW-069`. Documentation-only source-of-truth update for issue #69: `PRODUCT_INTENT.md`, `PEDAGOGY.md`, `LEARNER_JOURNEY.md`, and limited terminology edits in `CONTENT_GUIDE.md` if needed. No product code or architecture implementation is authorized by this plan.

## Level and parent

Level 1 plan. No parent plan is recorded in Core. This plan sits in Wave 0 of issue #106 and should precede #70, #71 and #72 because those issues depend on the product/pedagogy source of truth created here.

## Steps

`source-fact-review` -> `rewrite-product-intent` -> `rewrite-pedagogy` -> `rewrite-learner-journey` -> `align-content-terminology` -> `verify-and-summarize`. The ordered steps are declared in frontmatter with dependencies, rationale and expected deliverables.

## Approval

Approval-state: `pending`. No Construction bolt may run until the Product Owner approves this Inception proposal and the developer role confirms readiness. This file does not record human approval.
