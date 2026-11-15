# Ori-first Studio workspace for advanced learners

Issue #1638. Studio is an IDE-native place for learners who can work with code,
debugging and explicit software decisions. It shares the canonical Agorix
program with Web, but does not copy the Kids layout.

## First screen

Opening a local project shows the native code projection beside the Studio
Workbench. The Workbench puts the editable canonical program first, Ori at the
right, and execution evidence below the program. The block palette stays
available as a tool; mission, actors and assets move into a disclosure section.
The separate World Preview remains available on demand.

The interface takes inspiration from the project/editor/agent division and
reviewable agent changes described in the [Kiro IDE](https://kiro.dev/ide/).
Agorix's teaching boundary is different: Ori asks and explains, the learner
accepts or rejects proposals, and deterministic runtime evidence establishes
what the program did.

## Interaction contract

1. The learner opens a project and sees code and Workbench together. The code
   projection remains one tap away and synchronized with the canonical program.
2. The learner edits, predicts and runs. The stage and event trace appear in
   the evidence area beneath the program.
3. Ori occupies a stable companion area. Its intent/plan input is a structured
   learning workflow, not a free-form chat. Explanations and proposals still
   use the existing validated Companion and proposal paths.
4. A proposal remains provisional until an explicit learner decision. A run
   proves behavior; Ori's language never counts as proof.
5. With the provider unavailable, manual editing and deterministic execution
   remain available.

## Accessibility and responsive behavior

The view keeps a single page heading and labeled program, evidence and Ori
regions. It uses VS Code theme tokens, keyboard-focus indicators, reduced-motion
support and a single-column layout at narrow widths. Project details use a
native disclosure element, so they remain keyboard accessible.

## Deliberate next slice

The current intent field is not presented as a conversational Ori chat. A true
conversation needs a separate product contract for turn history, grounding,
privacy, safety and reviewed mutations before it is exposed to learners.
