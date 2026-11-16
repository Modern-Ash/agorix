# Ori-first Studio workspace for advanced learners

Issue #1638. Studio is an IDE-native place for learners who can work with code,
debugging and explicit software decisions. It shares the canonical Agorix
program with Web, but does not copy the Kids layout.

## First screen

Opening a local project shows a focused, full-width Studio Workbench. The
native code projection stays in the neighboring editor tab, one click away.
The VS Code primary sidebar and bottom panel close for this project-opening
flow; learners can reopen them with standard VS Code controls. The Workbench
puts Run and the stage above the editable canonical program, Ori at the right,
and detailed execution evidence below the program. This keeps the edit, run,
observe loop in the first viewport. Numeric block values are edited directly
on the block and committed through the canonical workspace transaction, with
stale edits and invalid values refused. The block palette is a visible toolbox with
drag handles, a click-to-add path and visible insertion targets while dragging.
An empty script shows its insertion target immediately. Mission, actors and
assets live in a disclosure section. The
separate World Preview remains available on demand.

The stage loads the initial deterministic frame when a project opens and uses
the same bundled gallery artwork as Web for known characters and backdrops.
Project PNG/WebP artwork is accepted only through the bounded creative asset
contract. The next visual parity work is tracked in epic #1648: richer visual
block composition, direct costume editing and full asset workflows.

The palette and canvas derive visual category tones and shapes from the shared
block vocabulary. Accepted blocks show typed values directly in their face,
including text fields; nested control bodies have a visible rail. Drag,
keyboard insertion and canonical workspace transactions remain the editing
authority. The visual block projection owns no separate program state.

The left library switches between Blocks and Scene. Scene shows actor cards and
visual costume/backdrop choices from the project's validated assets. Selection
is an explicit metadata edit; the host refuses unknown asset ids and refreshes
the deterministic stage after a change. Full image import/drawing and broader
component coverage remain in epic #1648.

The stage itself lets the learner select a visible actor and drag it to a new
position when execution is idle. Drop coordinates are mapped to the canonical
viewport, bounded to its edges and sent through the same explicit actor metadata
edit as the inspector. A running frame cannot be dragged.

The interface takes inspiration from the project/editor/agent division and
reviewable agent changes described in the [Kiro IDE](https://kiro.dev/ide/).
Agorix's teaching boundary is different: Ori asks and explains, the learner
accepts or rejects proposals, and deterministic runtime evidence establishes
what the program did.

## Interaction contract

1. The learner opens a project in the Workbench. The code projection remains
   one tab away and synchronized with the canonical program.
2. The learner edits a block value in place, predicts, runs and sees the stage
   immediately above the program. The event trace remains in the detailed
   evidence area beneath the program.
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
