# Advanced canvas proposals (design)

Sub-project 2 of the Studio "powerization" remainder. Date: 2026-10-05.

## Goal

Per-operation accept/skip/modify of an AI proposal on the canvas, applied as one transaction; up to two real alternatives side by side with runtime evidence; hints anchored to the affected block.

## Success criteria

- Nothing changes in the canonical program until the learner decides; reject (or an empty selection) produces zero transactions.
- "Apply selected" is one transaction: one undo step, one `modify` audit event; the prediction gate applies.
- Evidence is measured by the deterministic runtime only; nothing is claimed that was not run.
- Everything works with AI off and is deterministic in tests.

## Design

1. **Core (`packages/proposals`, pure).** `selectProposalOperations(review.proposal, baseProgram, { include, overrides })` returns a derived `ProgramProposal` (same `baseProgramHash`, chosen operations, edited values, revalidated) or `undefined` for an empty selection. Overrides only set `steps` / `degrees` / `count`. `resolveOperationTargets(program, proposal)` maps each operation to the original node id it touches, simulating index shift for repeated removals; appends have none.
2. **Alternatives (`agentPort`).** A task yields up to two real proposals (`first-step`: move 10 and move 5; `repeat-pattern`: one). Each gets evidence from running its candidate program (`stepsUsed`, `reachedGoal`, `outcome`) plus a fixed trade-off text.
3. **Protocol.** `proposal` gains `operations` (`index`, `kind`, `label`, `blockId?`, `editable?`), `evidence` and `alternatives`. New UI messages `chooseAlternative` and `previewSelection`; new host message `selectionEvidence`. `decideProposal` gains `selection`; with it the decision is `modified` and goes through `modifyProposal`.
4. **Canvas/panel.** Per operation: include checkbox and numeric input when editable; hint text anchored to the block (visible text and `aria-description`); excluded ghosts are dimmed; evidence of the current selection updates live. Alternatives render as side-by-side cards; choosing one replaces the pending proposal without applying.
5. **Errors.** Stale base hash: `STALE_PROPOSAL`. Invalid override: refused with a visible reason, nothing applied. Empty selection on apply: treated as reject.

## Out of scope

Provider-backed plans/alternatives (sub-project 3).
