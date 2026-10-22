# Agorix Kids: progressive advanced level

Status: product decisions recorded with the owner on 2026-10-22; design for review in Kids 16 (#387). This issue produces a design and issue breakdown only. Implementation follows in separate issues.

## Purpose and boundaries

The advanced level brings the existing actor, look, sound, event, variable and watcher capabilities into the **same Kids experience**. It is not a link to the parked `/advanced` editor. The map, worlds, Ori, typography, colors, touch controls and program/code layout remain familiar to a child who just finished Kids. The implementation reuses the canonical domain packages already powering those capabilities.

The child continues to own one canonical `ProjectProgram`. The visual editor and Agorix Code, Python and TypeScript views are projections; displayed code is not executed. Node means the TypeScript projection. Java stays in Kids 17 (#388), outside the advanced-level launch gate.

The invariants in [the Kids design](2026-10-21-agorix-kids-design.md) and `docs/FOUNDATIONS.md` remain: Ori proposes, the child chooses, the runtime proves; offline play works; provider details and failures are not shown to children; no child free text enters projects or evidence.

## Decisions made with the owner

| Question        | Decision                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry           | A visible advanced-level entry appears on the map after the **three authored Kids missions** are completed. Replaying one mission does not count three times. |
| Contents        | Capabilities open in three short stages, not all at once.                                                                                                     |
| Stage order     | 1. Actors, looks and sounds. 2. Events. 3. Variables and watchers. Code views stay available in the editor.                                                   |
| Progression     | One brief guided mission completes each stage and opens the next. Earlier stages remain replayable.                                                           |
| Ori             | The same structured proposal and review flow continues. Its block and operation allow-list widens only to the stage the child has reached.                    |
| Visual language | The previously approved Kids prototype remains the visual base, adapted to fit more tools without switching to the parked IDE.                                |

## Learning flow

1. The map derives entry eligibility from completed M1, M2 and M3 mission IDs in canonical project progress. The advanced destination appears when all three are complete.
2. Opening advanced starts stage 1 in a new advanced project. A short guided mission introduces the stage's new tools, then a free-play surface lets the child keep using them. The same pattern opens stages 2 and 3.
3. A stage completion comes from a deterministic runtime fact, never from Ori's assertion. A short child reflection is invited afterward and does not block completion. The stage gate is stored as structured progress and reconstructed on reload.
4. The editor keeps the world and the current code view near the blocks. Additional palette groups and actor/asset controls appear as their stage opens. Controls remain at least 44 px and usable at phone, tablet and desktop widths.

| Stage             | New tools                          | Guided mission must prove                                                                                          | Free play                                                         |
| ----------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 1: Create a scene | More than one actor, looks, sound  | A chosen actor changes appearance and produces a sound in a runtime run; the child identifies which actor changed. | Build a scene with the unlocked actor, look and sound controls.   |
| 2: Make it react  | Events and event-triggered scripts | A child action triggers an event and an observable change by an actor.                                             | Add reactions to the stage without leaving the canonical program. |
| 3: Keep score     | Variables and watchers             | A program changes a variable and the watcher shows the runtime value; the child predicts or explains the change.   | Combine unlocked tools from all stages.                           |

The mission wording and exact examples are authored and tested in the curriculum issue. If an existing runtime capability cannot prove a proposed condition, the mission must be narrowed to a condition it can prove before it is shown.

## Ori's advanced contract

- Preserve the Kids 09–13 text-only, tool-denied server boundary and a versioned structured output contract. Extend the proposal schema with actor, look, sound, event and variable operations only when that stage is implemented.
- The server validates the stage from stored progress and validates each proposed operation against that stage's allow-list and the canonical program. The browser repeats structural checks before display.
- Every proposal has a visible preview or diff, plus accept, change or reject. Acceptance is one undoable transaction. Ori never adds actors, assets, scripts or variables by itself.
- Any unsafe, unsupported, invalid or late model output uses a stage-specific deterministic fallback. The app remains playable with no model or network.
- Chat remains limited to program behavior, goals and app help. It does not gain access to personal topics or tools in advanced mode. `validateLearningCompanionSafety` still gates learner-facing output.

## Data and integration

- Extend project metadata with a versioned advanced-stage progress record. Keep it separate from the program and derive completed mission truth from runtime evidence. Do not infer completion from a clicked unlock button or a model response.
- Reuse `program-model`, `runtime`, `stage`, `block-editor`, `persistence`, `learning-evidence` and language projections. The parked `/advanced` UI can supply implementation examples, not a second editor or project authority.
- Existing Kids projects remain Kids projects. Entering advanced creates or resumes an advanced project; it does not silently rewrite the child's earlier work.
- Record only structured progress and proposal decisions. Do not persist chat transcripts, names, audio recordings or other child free text.
- Stage-gate and stage-specific proposal tests cover success, unavailable model, out-of-scope operations, reload, undo, keyboard/touch and orientation. Keep Spanish as the default and provide English copy.

## Implementation issue breakdown

These are proposed follow-up issues for the epic. Each issue must ship with its own deterministic tests, accessibility checks and a PR; none is implemented in Kids 16.

| Order | Issue                                               | Depends on     | Reviewable acceptance                                                                                                                                                                     |
| ----- | --------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1    | Advanced progression and three authored missions    | Kids 16 design | M1–M3 unlock the map entry once; stage gates use runtime evidence and survive reload; the curriculum defines one short mission per stage.                                                 |
| A2    | Advanced editor stage 1: actors, looks and sounds   | A1             | Same Kids shell; per-actor canonical edits, looks and sounds run in the real runtime; code stays visible; touch, keyboard and responsive journeys pass.                                   |
| A3    | Ori advanced proposal contract and stage 1 adapter  | A1, A2         | Structured, bounded actor/look/sound proposals are previewed and accepted explicitly; invalid operations and provider failure fall back safely.                                           |
| A4    | Stage 2: events and Ori event proposals             | A2, A3         | The event mission observes a real trigger and actor change; only stage-2 event operations become proposal candidates; earlier projects remain valid.                                      |
| A5    | Stage 3: variables, watchers and Ori data proposals | A4             | Watchers display runtime values, the mission checks a real variable change, and Ori is limited to stage-3 data operations.                                                                |
| A6    | Advanced end-to-end polish and learner validation   | A5             | Spanish tablet journey from Kids unlock through all stages, accessibility, offline fallback, persistence and code projection parity; revisit the flow using findings from Kids 18 (#389). |

Kids 17 (#388) supplies Java as an optional later projection and does not block A1–A6. Kids 18 requires the real session with Mora; its findings can revise the detailed missions and copy before advanced implementation is considered done.
