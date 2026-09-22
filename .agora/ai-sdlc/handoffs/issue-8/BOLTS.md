---
schema: "agora-ai-sdlc/artifact/v1"
kind: "bolt-plan"
version: 1
id: "BLP-008"
work: "issue-8"
revision: 1
traces-to: ["UOW-008", "PLN-008"]
unit: "UOW-008"
plan: "PLN-008"
proposed-by: "project:ai-primary"
approval-state: "pending"
approved-by: null
approved-revision: null
bolts:
  - id: "entry-no-account"
    mode: "sequential"
    status: "proposed"
    tasks: ["Finalize §1 entry/mission/no-account wording", "Confirm First-Mission-only scope"]
    depends-on: []
    writes: ["docs/product/LEARNER_JOURNEY.md"]
    produces: []
    evidence: []
  - id: "editor-ia"
    mode: "sequential"
    status: "proposed"
    tasks:
      [
        "Lock desktop split ratio (D1)",
        "Write crisp narrow-viewport code-visibility rule (D2)",
        "Document blocks-area layout (D4)",
        "Document block→code highlight and mission/tutor placement (D5, D6)",
      ]
    depends-on: ["entry-no-account"]
    writes: ["docs/product/LEARNER_JOURNEY.md"]
    produces: []
    evidence: []
  - id: "blocks-code-consistency"
    mode: "sequential"
    status: "proposed"
    tasks:
      [
        "Enumerate required POC block set",
        "State single canonical model derivation",
        "Document immediate read-only never-executed projection",
      ]
    depends-on: ["editor-ia"]
    writes: ["docs/product/LEARNER_JOURNEY.md"]
    produces: []
    evidence: []
  - id: "run-iterate"
    mode: "sequential"
    status: "proposed"
    tasks:
      [
        "Document Run/Stop/Reset",
        "Document edit-during-run stop semantics (D3)",
        "Document behavior-based failure feedback",
      ]
    depends-on: ["blocks-code-consistency"]
    writes: ["docs/product/LEARNER_JOURNEY.md"]
    produces: []
    evidence: []
  - id: "tutor-stuck-path"
    mode: "sequential"
    status: "proposed"
    tasks:
      [
        "Align hint ladder L0-L5 with PEDAGOGY.md",
        "Document tutor-disabled core loop and stuck path",
      ]
    depends-on: ["run-iterate"]
    writes: ["docs/product/LEARNER_JOURNEY.md"]
    produces: []
    evidence: []
  - id: "completion-persistence"
    mode: "sequential"
    status: "proposed"
    tasks:
      [
        "Document deterministic completion, reflection, free play",
        "Document persistence/exit (D7)",
        "Record decision provenance and out-of-scope",
      ]
    depends-on: ["tutor-stuck-path"]
    writes: ["docs/product/LEARNER_JOURNEY.md"]
    produces: []
    evidence: []
  - id: "independent-review"
    mode: "sequential"
    status: "proposed"
    tasks:
      [
        "Run independent product review against PRODUCT_INTENT.md and MVP.md",
        "Record review evidence against issue #8 acceptance",
      ]
    depends-on: ["completion-persistence"]
    writes: ["docs/product/LEARNER_JOURNEY.md"]
    produces: []
    evidence: []
required-sections: ["Scope", "Bolts", "Conflicts", "Approval"]
---

# Bolt Plan

## Scope

Unit `UOW-008` delivered by authorizing plan `PLN-008`. Seven sequential bolts edit and review `docs/product/LEARNER_JOURNEY.md`. No bolt writes product code.

## Bolts

Ordered sequential bolts, each declared in the frontmatter `bolts` list with tasks, dependencies, write set, produced artifacts and evidence: `entry-no-account` → `editor-ia` → `blocks-code-consistency` → `run-iterate` → `tutor-stuck-path` → `completion-persistence` → `independent-review`. Each bolt's `depends-on` references every earlier bolt, satisfying the sequential-ordering rule; all `status` values are `proposed` while the plan is pending.

## Conflicts

Every bolt is `sequential` and depends on all earlier bolts, so no two bolts can run concurrently and their shared write set (`docs/product/LEARNER_JOURNEY.md`) is safe. There are no parallel pairs to keep disjoint.

## Approval

Approval-state: `pending`. No bolt may run until the plan revision is approved by the product-owner role (`project:product-owner`). `approved-by` and `approved-revision` are intentionally null; no human approval is fabricated.
