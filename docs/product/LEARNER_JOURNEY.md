# POC Learner Journey and Editor Information Architecture

Traces to GitHub issue #8. Source: PRODUCT_INTENT.md, MVP.md, PEDAGOGY.md, AGENTS.md. Deliverable of Level 1 Plan `PLN-008` (approved revision 1); product decisions D1-D8 per "Decision provenance".

## 1. Project / mission entry

- Learner creates or opens a local project (MVP.md "Home / project entry").
- Learner selects "First Mission." For the POC, First Mission is the only functional mission; no mission catalog/list UI is required (human-selected POC decision).
- No account creation, login or public-sharing step exists at any point (PRODUCT_INTENT.md non-goals; issue #8 acceptance).

## 2. Editor first load

Layout (desktop/normal viewport):
- 60% blocks workspace / 40% generated code panel, side by side, with the generated code panel as the right-hand surface of the desktop layout (human-selected POC decision; D1).
- Mission context lives in a top/header area, visible without navigating away from the editor.
- Stage/canvas, one starter sprite, block toolbox and workspace are visible immediately (MVP.md "Editor").
- Within the blocks workspace, the POC uses a classic arrangement: block toolbox in a left rail, stage/canvas top-center, workspace center (D4, confirmed). Narrow-width rail/toolbox refinements are implementation detail.
- Run / Stop / Reset controls are always reachable from the main editor view.
- Tutor/help is a contextual side panel or non-blocking overlay; exact visual treatment is an implementation detail (human-selected POC decision) but it must never cover or replace the code panel.

Narrow viewport:
- Panels stack vertically: blocks first, generated code immediately below (human-selected POC decision).
- A single CSS breakpoint (approx. 768px; the exact value is an implementation detail) switches desktop side-by-side to the vertical stack, at all orientations.
- In the stacked layout the generated-code panel occupies the band immediately below the blocks workspace; it remains continuously visible, never behind a tab, toggle, scroll region or "advanced mode" at any viewport width (issue #8 required layout decision; MVP.md "Persistent code bridge").
- Code-visibility rule (D2, confirmed): in the stacked layout the generated-code band is pinned below the blocks workspace. "Usable editor viewport" means the editor area excluding the mission/header band. The band targets roughly 40% of the usable editor viewport as a responsive guideline (not a hard ratio) and has a concrete minimum visible height of 240px that always holds; on very constrained screens the shared area shrinks but never below this floor.
- The code band itself never scrolls out of the editor viewport; only the blocks workspace scrolls internally. Code content may scroll internally inside the pinned code band for long programs; the band as a whole stays pinned and on screen.
- Mission context stays in the top/header area and Run / Stop / Reset remain reachable at narrow widths without leaving the editor or scrolling the workspace away (e.g., controls carried in the header).
- The tutor is non-blocking and may overlap the blocks region, but it must never cover or replace the generated-code panel (per §2).

## 3. Visual programming attempt

- Learner drags/composes blocks from the required POC set: `when run starts`; `move steps`, `turn`; `repeat N`, `if condition`; `touching goal?` (MVP.md "Required blocks").
- Every block change updates the canonical program model; blocks and generated code both derive from that one model and never own separate state (AGENTS.md "Agorix-specific invariants").

## 4. Continuous code observation

- The generated-code panel is visible at all times during normal editing; the learner never switches modes to see it (MVP.md, AGENTS.md).
- Every supported block change updates the textual projection immediately.
- Selecting a block highlights its corresponding code region (required, human-selected POC decision).
- Selecting code highlighting the corresponding block is optional, implemented only if cost stays low (human-selected POC decision).
- The generated code is read-only in the POC and is never executed (AGENTS.md).

## 5. Run / fail / iterate

- Run executes the program deterministically against the fixed/update loop runtime (MVP.md "Runtime").
- Stop halts execution.
- Reset stops execution and returns the stage/sprite to the mission's initial state (starting positions); it does not delete or revert the learner's block program or the generated-code projection.
- Editing blocks while a program is running stops the current run before the change takes effect; the learner re-runs to observe the new behavior (no concurrent edit-during-execution).
- On a failed or incomplete attempt (e.g., sprite does not reach the goal), the learner sees an observable, behavior-based outcome rather than an opaque pass/fail label (PEDAGOGY.md "Feedback").
- The learner edits blocks and re-runs freely; the loop (compose → run → observe → adjust) is the primary iteration cycle (PRODUCT_INTENT.md "Product promise" steps 4-6).

## 6. Help / tutor

- The learner may request help from the tutor panel/overlay at any point, with or without a prior failed or incomplete attempt.
- The tutor follows the hint ladder (PEDAGOGY.md): Level 0 no hint → Level 1 diagnostic question → Level 2 concept reminder → Level 3 point to the relevant program area → Level 4 partial structural example → Level 5 complete explanation (only after explicit learner request or repeated failure).
- The hint level used is recorded for later product evaluation of over-assistance (PEDAGOGY.md).
- The tutor can be disabled entirely; the core editor/runtime/mission loop still functions without it (MVP.md "Exit criteria"; AGENTS.md "Product invariants").
- When the tutor is unavailable (disabled or unreachable), the stuck path falls back to the core loop: re-read the mission goal, inspect the generated code against the blocks, edit and re-run, and Reset to the mission's initial state; the mission remains completable without any tutor support.

## 7. Mission completion

- Completion is evaluated deterministically by runtime/state (e.g., `touching goal?` becomes true), never by an LLM judgment (PEDAGOGY.md "Completion"; MVP.md "Mission").
- On completion, the learner sees confirmation tied to the mission's completion predicate, not a generic congratulatory screen replacing the editor context.

## 8. Reflection / free play

- After completion, the tutor asks one short reflection question (e.g., "What made the character start moving?") (PEDAGOGY.md "Reflection").
- Reflection is optional: it is recorded as learning evidence but never blocks or gates basic POC completion.
- If the tutor is unavailable or disabled, reflection is skipped and the learner continues directly to free play; the tutor is not a dependency of mission completion, which is evaluated by runtime/state (§7).
- After reflection (or by skipping it), the learner may continue in free-play on the same project; free-play remains available and is not a separate mode requiring re-entry (PRODUCT_INTENT.md "Differentiators to validate").

## Happy path and stuck path mapping

Happy path: Project/mission entry (§1) → editor first load (§2) → visual programming attempt (§3) with continuous code observation (§4) → Run succeeds (§5) → mission completion (§7) → reflection, skippable (§8) → free play (§8).

Stuck path: entry (§1) → editor first load (§2) → attempt (§3) → Run fails or is incomplete (§5) → observe behavior-based outcome → edit and re-run; repeat as needed → optional tutor help at any point (§6), or core-loop fallback when the tutor is unavailable (§6) → completion (§7) → reflection/free play. A learner may enter the stuck path cycling indefinitely between §5 and §6 before completing.

## Persistence and exit

- Autosave writes continuously to the versioned local project document; there is no manual "save" step the learner must remember (human-selected POC decision; MVP.md "Persistence").
- A version mismatch on load fails explicitly rather than silently corrupting the project (MVP.md "Persistence"): the editor refuses to open the mismatched project, shows a blocking, plain-language message identifying the unsupported document version, and offers to start a new project; no partial or corrupted blocks/code are rendered.
- Exit requires a confirmation prompt only when persistence has actually failed or unsaved state can exist; routine exit after a successful autosave requires no confirmation (human-selected POC decision).
- Reload of a fresh browser session retains the project and reproduces a consistent block/code state (MVP.md "Exit criteria").

## Decision provenance

The following eight choices are human-selected product decisions D1-D8 confirmed by the Product Owner (`project:product-owner`) on 2026-09-22 in the Inception interaction for issue #8. Recorded here for the implementation team; the implementation must follow them as decided and must not silently change them:

- **D1** Desktop split: 60% blocks workspace / 40% generated code panel, side by side (§2).
- **D2** Narrow viewport: vertical stack, blocks first, code band pinned below, targeting ~40% of the usable editor viewport as a responsive guideline, with a 240px minimum visible band height; blocks workspace scrolls internally; code never leaves the viewport (§2).
- **D3** Edit-during-run stops the current run before the change takes effect; the learner re-runs to observe (§5).
- **D4** Blocks-area layout: toolbox left rail, stage/canvas top-center, workspace center (§2).
- **D5** Tutor/help is a contextual side panel or non-blocking overlay; exact visual treatment is implementation detail and must never cover or replace the code panel (§2, §6).
- **D6** Block→code highlighting is required; code→block highlighting is optional and cost-gated (§4).
- **D7** Continuous autosave, no manual save step; exit confirmation only when persistence has failed or unsaved state can exist (Persistence and exit).
- **D8** "First Mission" is the only functional mission; no mission catalog/list UI is required (§1).

Approval context: the Level 1 Plan `PLN-008` revision 1 authorizes this documentation deliverable and was approved by the Product Owner; that approval is recorded in the Plan artifact only. These D1-D8 choices are recorded as human-selected product decisions in this document, not as first-class Agora/Core decision records and not as standalone auditable Agora approval evidence. Durable decision recording is a framework gap tracked in Agora AI-SDLC issue #155; until that mechanism exists, the choices above rely on this document plus the approved Plan as their provenance.

## Explicitly out of scope for this journey

- Public sharing, accounts, badges, dashboards, remixing, classroom administration, payments, multiplayer, native mobile apps, hardware integration (PRODUCT_INTENT.md non-goals).
- React component implementation (issue #8 "Agent handoff").
- Any mission other than "First Mission" (human-selected POC decision).
