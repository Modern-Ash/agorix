# Agorix Studio architecture

## Purpose

Agorix Studio is the VS Code surface for learners who are ready to work closer to code, debugging evidence and software-development practices. It reuses the same canonical program, runtime, curriculum, LanguageProjection, Learning Companion and ProgramProposal boundaries as Web.

Studio is not Scratch embedded in VS Code. It is an IDE-native learning surface that keeps the accepted program, code projection, runtime evidence and proposal review distinct.

## Studio Agent and canvas

The AI-native agent, the Director/Auditor pedagogy and the canvas projection are specified in [`STUDIO_AGENT.md`](./STUDIO_AGENT.md) and [ADR 0006](../architecture/adr/0006-studio-agent-and-canvas.md) (epic #242).

## Studio shell and webview framework (issue #252)

- Side bar views (Projects, Missions, Progress, Worlds, Inspector) are icon-first: short labels, a count or state in the row description and view title, detail in tooltips, and collapsed children for progressive disclosure. State colors are VS Code theme tokens only (`STUDIO_STATE_THEME_COLORS`); AI-provisional rows use the `ai` state, never the success color.
- Run, Step, Stop and Reset are icon actions in the editor title and in the execution views' titles; Run/Stop/Reset visibility follows the `agorixStudio.executionStatus` context key. The projection switch is an editor-title icon.
- `extensions/vscode/src/webview/framework.ts` is the shared webview framework for the World Preview and later palette and proposal visuals: nonce-only strict CSP, shared styles built on VS Code theme tokens (light, dark and high-contrast via `vscode-high-contrast*`, `forced-colors`, `prefers-reduced-motion`), a validated message protocol in both directions (`validateMessage`, allowlisted outbound types), and landmark/label/live-region conventions. New webviews must use it and must not add inline handlers, remote origins or hard-coded colors.

## Ambient Companion presence (issue #250)

The ambient presence slice makes the Studio Agent visible without making it loud:

- `extension.ts` is now a thin activation entry point; command, session, view and runtime wiring live in focused modules under `extensions/vscode/src`.
- The Companion status indicator defaults to a quiet icon, offers help through a quick pick and uses explicit off, working and budget-capped states.
- CodeLens and code actions are scoped to the current selection or failing node, with short icon-first actions for explain, debug, challenge, propose and reflect.
- Studio signals flow through System 0 and optional LAYA veto before any offer appears; no provider call happens until the learner accepts an action.
- Ambient offer decisions now route through the Studio decision pipeline for the same diagnostics and LAYA path used by proposals. The ambient router is deterministic before acceptance, so no provider request or generated content happens merely because a hint is shown.
- When an ambient offer is tied to runtime evidence for a canonical node, the Workbench shows a small canvas hint on that block. Hints are cleared when the learner accepts, dismisses or the offer goes stale, and proposal review still owns the stronger ghost-block treatment.
- Declines, ignores, cooldowns, AI agreements and the session ambient-request budget all bias toward silence and economy.

This slice is infrastructure for the Studio direction, not the final experience: the next work should measure offer quality, anchor suggestions on the Workbench canvas, export non-PII evidence and route accepted generative actions through the full LAYA/provider budget pipeline.

## Live sync

A host-side `SyncHub` (`extensions/vscode/src/sync/syncHub.ts`) holds one selected, one executing and one failed canonical node id. The canvas, code editor, World Preview and Inspector write selections into it; each surface reflects the shared state (canvas via the `sync` protocol message mapped to block ids, code via reveal and run/fail decorations, World Preview via `agorix-sync`, Inspector via tree reveal). Failure is shown with text and an accessible description, never color alone. A program change reconciles the hub so removed nodes are cleared.

## Agent gating and Workbench robustness

- An unclear intent (no task keyword, more than one task available) gets at most one clarifying question made of fixed task titles; the learner text is never echoed or stored.
- A plan is anchored to the program hash it was made against. If the program changes before the plan is accepted, the plan is dropped (`STALE_PLAN`).
- Workbench intent planning uses the provider-neutral intent-plan contract. When AI is configured it may call the validated `/intent-plan` provider boundary; unavailable, invalid or stale provider output falls back to the deterministic local planner. Both paths map back to fixed task cards and never echo learner free text as task titles.
- Workbench density is configurable (`agorixStudio.workbench.density`: `comfortable` or `compact`) so Studio can stay readable for first use and denser for repeated IDE editing.
- Workbench and Agent chrome read the project locale metadata and support fixed English/Spanish UI copy. Dynamic proposal text, provider notices and learner-entered intent remain source text rather than being translated by the UI.
- Workbench edits carry the `programHash` the UI last saw; a stale edit is refused (`STALE_EDIT`) and a fresh snapshot is sent.
- A refused placement explains why (`NOT_A_CONTAINER`, `BAD_INDEX`, `BLOCK_NOT_FOUND`, `NOT_A_STATEMENT`, `WOULD_BREAK_PROGRAM`) in the live status region.
- Agent agreement `requirePredictionBeforeAccept` (off by default): the learner must predict before accepting an AI suggestion. It never blocks manual edits, and rejecting never needs a prediction.

## Advanced canvas proposals

- A proposal shows its operations as a list. The learner keeps or skips each one and may edit a numeric value (`steps`, `degrees`, `count`). "Apply selected" derives a narrower, revalidated proposal and commits it as one transaction (one undo step, one `modify` decision). An empty selection is a rejection and changes nothing.
- A task may offer a second real proposal (for example a shorter first step). Alternatives sit side by side; choosing one only swaps the pending proposal.
- Evidence on every proposal and on the current selection comes from running the candidate program in the deterministic runtime (steps used, whether it reaches the goal). Trade-off texts are fixed; nothing is claimed that was not run.
- Each suggested change is anchored to its block as visible text and an accessible description; skipped changes are dimmed. The prediction gate applies to "Apply selected" as well.

## Provider-backed proposals

- Companion "build" and the Workbench agent loop obtain proposals through one seam (`studioProposalSource.ts`). The Studio decision pipeline (System 0, optional LAYA, a policy router and a request budget) decides whether a provider may be asked; the client then validates the contract and safety of the answer, and the proposal is validated again (including base-hash freshness).
- A provider proposal is a normal `ProgramProposal`: it is reviewed, selected per operation and decided by the learner. The built-in suggestion stays available as an alternative with runtime evidence.
- Every failure (AI off, no endpoint, route unavailable, budget spent, unavailable or rejected provider, invalid or stale proposal) degrades to the built-in proposal with a short learner notice. Editing and running never depend on a provider.
- Budget: `agorixStudio.agent.proposalBudgetRequests` (default 10 per session). Telemetry holds enums and numbers only; learner text never reaches it.
- Educator evidence export is local and user-initiated (`agorixStudio.exportEducatorEvidence`). It summarizes one session with counts only: proposal decisions, predictions, explanations, ambient offers, settings and deterministic runtime completion. It writes JSON plus a Markdown summary to files the user chooses and contains no names, emails, paths, learner text or raw model output.

## Assistance ceiling

The "help level up to N" agreement (default 4) limits what the agent may show, on every agent surface (ADR 0008). 0 shows nothing; 1 diagnostic questions; 2 adds concept reminders; 3 adds pointing to the relevant blocks; 4 adds bounded proposals, AI or built-in; 5 adds no new kind (a complete explanation needs an explicit request after repeated failure). Below 4, "Show me a suggestion" gives the most help the level allows and a line saying the level can be raised; the Companion actions (challenge and reflect need 1, explain 2, debug 3, build 4), the built-in "Suggest first step / repeat" commands, ambient offers and the CodeLens actions that need more are hidden or declined with the same sentence. The Workbench agreements now reach the session too, so the level, the AI toggle and the mode apply to ambient offers and commands, not only to the Workbench loop.

## Studio localization

- The manifest (command titles, view names, settings, welcome text) is localized with `package.nls.json` and `package.nls.es.json`. Runtime messages, dialogs, quick picks, CodeLenses, the status bar and tree labels go through `t()` (`src/l10n.ts`, `vscode.l10n.t`) with `l10n/bundle.l10n.es.json`; the English text is the key and `{0}` marks values.
- The language follows the VS Code display language. The Workbench keeps following the project's locale (set at creation), so the two can differ.
- `src/l10n.test.ts` fails when a `%key%`, a `t()`/`msg()` literal or a placeholder is missing from either bundle, and `.vscodeignore` must ship the bundles.
- Not localized: proposal and provider text (pending a privacy decision), the dynamic ambient tooltip with the offer reason, and mission/world titles, which come from the curriculum already localized.
- The packaged VSIX contains the bundles; the real Spanish UI path was not exercised in VS Code because no Spanish language pack is installed in the test profile.

## Canvas accessibility

- **One tab stop.** The canvas is a single tab stop (roving tabindex). Arrow Up/Down, Home and End move between blocks; the action buttons are tabbable only on the active block.
- **Names carry structure.** Each block is named with its position and nesting level ("Move [N] steps, 2 of 5, level 2"), in English and Spanish.
- **Keyboard parity.** Enter or Space on a block shows it in the code (it was click-only). Alt+Up/Down moves a block and Delete removes it, as before. A visible help line is linked with `aria-describedby`.
- **Focus follows the work.** After a move the focus stays on the moved block; after a delete it goes to the next block, then the previous one, then the canvas; after inserting from the palette it goes to the new block. Blocks are located by container and index because block ids are positional.
- **Announcements.** Moves, deletes and inserts, and impossible moves ("Already the first block here"), are announced in the polite live region and survive the generic "Updated"; a refusal from the host replaces them.
- **High contrast.** `forced-colors` rules keep selected, running, failed and suggested states distinguishable with system colors; action buttons are at least 32 px.
- **Tests.** `canvas.a11y.test.tsx` drives a real DOM (jsdom) with keyboard events and runs axe-core for roles, names and ARIA validity. Axe cannot check color contrast in jsdom, so contrast and a screen-reader pass remain manual.
- **Not covered.** Nesting and outdenting with the keyboard (the Web editor has it), text size and zoom.

## Release gate

Studio's product release gate is
[`STUDIO_RELEASE_GATE.md`](./STUDIO_RELEASE_GATE.md). It records the Web/Studio
capability parity matrix, required journeys, automated evidence and intentional
UX differences for issue #214. #204 should close only after that gate and the
listed CI evidence stay green.

## First slice

Issue #38 delivers the first Studio slice:

- VS Code extension package scaffold under `extensions/vscode`;
- shared project loading from the existing stored-project contract;
- textual projection and canonical node-to-editor range mapping;
- World Preview frame data derived from runtime observations;
- Execution Inspector rows derived from the same runtime trace;
- ProgramProposal inspect, reject and explicit apply behavior;
- fixtures that #121 can use for the full Web/Studio round-trip proof.

Full Git workflows, marketplace publishing, AI-assisted SDLC and complete Web/Studio compatibility remain later work. #121 owns the full cross-surface compatibility proof after Studio can read and write the shared project contract.

The compatibility proof is specified in
[`CROSS_SURFACE_COMPATIBILITY.md`](./CROSS_SURFACE_COMPATIBILITY.md): Studio,
Web and Tablet share `StoredProject` as the canonical project envelope, while UI
preferences such as panel focus, theme, projection and locale remain outside the
semantic program hash.

## Surface model

| Surface                 | First-slice role                                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Activity Bar / Side Bar | Mission, project and progress entry points.                                                                                                  |
| Editor                  | Textual projection first, with canonical node range mapping.                                                                                 |
| Workbench               | Canvas projection of the canonical program with an icon-first palette, drag and drop and keyboard equivalents; opens beside the code editor. |
| Agent column            | Director/Auditor loop beside the canvas; proposals appear as ghost blocks.                                                                   |
| Ambient Companion       | Quiet status indicator, selected-node actions and proactive offers governed by System 0/LAYA before any provider call.                       |
| World Preview           | Webview-friendly frame data rendered from mission/runtime/world state.                                                                       |
| Execution Inspector     | Current node, statement type and before/after world state.                                                                                   |
| AI proposal review      | Inspect, reject or explicitly apply structured proposals.                                                                                    |

Workbench palette entries are derived from the shared toolbox. Entries that are
not valid direct script insertions explain why they are disabled instead of
allowing a doomed edit.

## Boundaries

- The accepted canonical program is the only program authority.
- Studio must not create a second schema or runtime.
- Generated text is a projection; it is not executed as arbitrary JavaScript.
- ProgramProposal data is pending until the learner explicitly applies it.
- Rejecting a proposal leaves accepted state unchanged.
- VS Code API imports stay inside extension/adapters.
- Shared packages remain platform-neutral.
- Studio must work without remote AI provider credentials.

## Shared inputs

Studio first-slice modules use:

```text
StoredProject
MissionDefinition
ProjectProgram
ProjectionResult
RunResult / RuntimeObservation
StageRenderFrame
ProgramProposal
```

The same inputs can feed Web, Studio and #121 compatibility fixtures.

## Visual direction

Studio follows the #117 design system in an IDE-density form:

- code and evidence have visual weight;
- proposal UI uses AI/provisional treatment, never success styling;
- World Preview carries visual motivation without taking over product chrome;
- runtime evidence stays adjacent to code/debugging context.

## Canvas

Studio has one canvas: the Workbench (see the surface table). It is an IDE-native projection of the canonical program (ADR 0006, ADR 0007) rendered from `@agorix/block-editor` workspace data; edits are intents applied through canonical transactions and never canvas-local state. A separate "canvas editor" webview was merged on a stacked branch and not landed, because it duplicated the Workbench; its history stays in git (#267).

POC accessibility limit: the canvas exposes keyboard-focusable block buttons and keyboard equivalents for move and delete, but it does not yet implement a full spatial keyboard model or a screen-reader equivalent for all drag gestures. Those gaps stay documented until a later accessibility slice adds parity controls.

## #121 handoff

This slice provides deterministic fixture semantics:

- a Web-created stored project can be opened and projected in Studio;
- Studio can produce an explicitly applied modified stored project;
- #121 should verify the modified fixture reopens in Web without semantic drift.
