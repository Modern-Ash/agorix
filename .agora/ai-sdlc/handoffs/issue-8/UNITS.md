---
schema: "agora-ai-sdlc/artifact/v1"
kind: "unit-of-work"
version: 1
id: "UOW-008"
work: "issue-8"
revision: 1
traces-to: ["INT-008"]
criteria:
  - "entry-no-account"
  - "editor-ia"
  - "blocks-code-consistency"
  - "run-iterate"
  - "tutor-stuck-path"
  - "completion-persistence"
required-sections: ["Scope", "Acceptance criteria", "Dependencies", "Bolts"]
---

# Unit of Work

## Scope

Single cohesive documentation unit delivering `docs/product/LEARNER_JOURNEY.md` for intent INT-008 (issue #8): the POC learner journey and editor information architecture. Six contiguous documentation slices, independently reviewable, none of which requires writing product code.

## Acceptance criteria

- `entry-no-account`: §1 entry/mission flow (create/open local project → First Mission → editor) with no account, login or public-sharing surface anywhere in the POC journey.
- `editor-ia`: §2/§4 dual-surface layout — initial split ratio, narrow-viewport degradation with a crisp code-visibility rule, block→code selection highlight, mission context and Run/Stop/Reset reachable without leaving the editor.
- `blocks-code-consistency`: §3/§4 required block set, single canonical program model (no dual state), immediate read-only textual projection that is never executed.
- `run-iterate`: §5 Run/Stop/Reset semantics including edit-during-run behavior and behavior-based failure feedback.
- `tutor-stuck-path`: §6 hint ladder L0-L5 with recorded hint level, tutor-disabled core loop, and documented stuck path.
- `completion-persistence`: §7-§8 deterministic completion, optional non-blocking reflection, free play; plus persistence/exit and decision provenance.

## Dependencies

Traces to intent INT-008. Requires the bounded inputs from issue #8 (`PRODUCT_INTENT.md`, `MVP.md`, `PEDAGOGY.md`) plus `AGENTS.md` and the invariants in `docs/architecture/SYSTEM_DESIGN.md` / `docs/architecture/AI_TUTOR.md`. Blocks on the confirmed decisions card D1-D8 (per Level 1 Plan `PLN-008`, step `clarify-intent`) before `editor-ia`, `run-iterate` and `completion-persistence` wording is final.

## Bolts

Delivered by bolt-plan `BLP-008` (see `BOLTS.md`). Six sequential documentation bolts map 1:1 to the criteria above, followed by an independent product review bolt.
