---
schema: "agora-ai-sdlc/artifact/v1"
kind: "bolt-plan"
version: 1
id: "BLP-069"
work: "issue-69"
revision: 1
traces-to: ["UOW-069","PLN-069"]
unit: "UOW-069"
plan: "PLN-069"
proposed-by: "project:ai-codex"
approval-state: "pending"
approved-by: null
approved-revision: null
bolts: [{"id":"product-intent","mode":"sequential","status":"proposed","tasks":["Rewrite vision, promise, differentiators and non-goal boundaries around AI-native learner agency","Record Scratch-plus-chatbot differentiation and provider independence"],"depends-on":[],"writes":["docs/product/PRODUCT_INTENT.md"],"produces":["product-definition-summary"],"evidence":[]},{"id":"pedagogy-model","mode":"sequential","status":"proposed","tasks":["Define scaffolding and gradual release","Add prediction before execution, reflection after success, behavior-specific feedback and anti-over-assistance rules","Clarify proposal/accepted/executed distinction"],"depends-on":["product-intent"],"writes":["docs/product/PEDAGOGY.md"],"produces":["pedagogy-invariants"],"evidence":[]},{"id":"learner-journey","mode":"sequential","status":"proposed","tasks":["Rewrite the complete learner loop","Keep blocks and code continuously visible","Tie debugging and explanation to runtime facts"],"depends-on":["pedagogy-model"],"writes":["docs/product/LEARNER_JOURNEY.md"],"produces":["journey-loop"],"evidence":[]},{"id":"content-terminology","mode":"sequential","status":"proposed","tasks":["Replace narrow tutor wording only where it conflicts with learning-companion terminology","Preserve child-facing safety and copy constraints"],"depends-on":["learner-journey"],"writes":["docs/product/CONTENT_GUIDE.md"],"produces":["terminology-alignment"],"evidence":[]},{"id":"verification-and-pr-evidence","mode":"sequential","status":"proposed","tasks":["Trace acceptance criteria against changed docs","Record unresolved decisions","Prepare PR evidence: before/after summary, changed invariants and independent review requirement"],"depends-on":["content-terminology"],"writes":["docs/product/PRODUCT_INTENT.md","docs/product/PEDAGOGY.md","docs/product/LEARNER_JOURNEY.md","docs/product/CONTENT_GUIDE.md"],"produces":["acceptance-trace","pr-evidence"],"evidence":["documentation-review"]}]
required-sections: ["Scope","Bolts","Conflicts","Approval"]
---

# Bolt Plan

## Scope

Unit `UOW-069` delivered by authorizing plan `PLN-069`. Five sequential documentation bolts prepare the source-of-truth rewrite and review evidence. No bolt writes product code.

## Bolts

Ordered sequential bolts: `product-intent` -> `pedagogy-model` -> `learner-journey` -> `content-terminology` -> `verification-and-pr-evidence`. All bolt details are declared in frontmatter with dependencies, write sets and expected outputs.

## Conflicts

All bolts are sequential because they share the same product source-of-truth contract. No parallel write is proposed.

## Approval

Approval-state: `pending`. No bolt may run until the Product Owner approves the Inception proposal. `approved-by` and `approved-revision` are intentionally null.
