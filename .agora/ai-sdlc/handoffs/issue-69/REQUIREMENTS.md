---
schema: "agora/requirements/v1"
id: "issue-69-ai-native-product-source"
intent: "issue-69"
work: "issue-69-delivery/issue-69"
source: "https://github.com/Modern-Ash/agorix/issues/69"
---

# Requirements: Issue #69 AI-native product source of truth

## R1 - Product definition

`docs/product/PRODUCT_INTENT.md` must define Agorix as an open-source, AI-native programming learning environment for children, not as a block editor with optional tutor help.

## R2 - North-star invariants

The source documents must encode both principles: "AI proposes. Child decides. Runtime proves. Child explains." and "Nothing happens under the rug."

## R3 - Learner agency

The documents must make learner authorship testable: AI-originated structures or changes are proposals only until the learner inspects and accepts, modifies or rejects them.

## R4 - Visible program and evidence

Blocks and textual code must remain visible during normal learning flow; deterministic runtime observations outrank AI claims about behavior.

## R5 - No hidden mutation

No hidden AI-originated program mutation is permitted. The learner-visible distinction between proposal, accepted program and executed result must be explicit.

## R6 - Pedagogy before automation

`PEDAGOGY.md` must define scaffolding, gradual release of responsibility, prediction before execution where appropriate, reflection after success, behavior-specific feedback and anti-over-assistance rules.

## R7 - Complete learner loop

`LEARNER_JOURNEY.md` must cover the complete loop from learner intent through clarification/decomposition, bounded AI proposal, learner decision, visible blocks/code, prediction, deterministic execution, observation, evidence-grounded debugging, improvement and learner explanation.

## R8 - Terminology consistency

The three source-of-truth documents must use consistent terminology for AI as a learning companion/scaffold, not primarily as a stuck-path chatbot. `CONTENT_GUIDE.md` should be changed only where terminology must align.

## R9 - Explicit unresolved decisions

Open decisions must be recorded explicitly rather than invented silently, especially any boundary between learning companion capabilities and later architecture contracts.
