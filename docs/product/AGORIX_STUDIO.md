# Agorix Studio architecture

## Purpose

Agorix Studio is the VS Code surface for learners who are ready to work closer to code, debugging evidence and software-development practices. It reuses the same canonical program, runtime, curriculum, LanguageProjection, Learning Companion and ProgramProposal boundaries as Web.

Studio is not Scratch embedded in VS Code. It is an IDE-native learning surface that keeps the accepted program, code projection, runtime evidence and proposal review distinct.

## Studio Agent and canvas

The AI-native agent, the Director/Auditor pedagogy and the canvas projection are specified in [`STUDIO_AGENT.md`](./STUDIO_AGENT.md) and [ADR 0006](../architecture/adr/0006-studio-agent-and-canvas.md) (epic #242).

## Studio shell and webview framework (issue #252)

- Side bar views (Projects, Missions, Progress, Worlds, Inspector) are icon-first: short labels, a count or state in the row description and view title, detail in tooltips, and collapsed children for progressive disclosure. State colors are VS Code theme tokens only (`STUDIO_STATE_THEME_COLORS`); AI-provisional rows use the `ai` state, never the success color.
- Run, Step, Stop and Reset are icon actions in the editor title and in the execution views' titles; Run/Stop/Reset visibility follows the `agorixStudio.executionStatus` context key. The projection switch is an editor-title icon.
- `extensions/vscode/src/webview/framework.ts` is the shared webview framework for the World Preview and later canvas, palette and proposal visuals: nonce-only strict CSP, shared styles built on VS Code theme tokens (light, dark and high-contrast via `vscode-high-contrast*`, `forced-colors`, `prefers-reduced-motion`), a validated message protocol in both directions (`validateMessage`, allowlisted outbound types), and landmark/label/live-region conventions. New webviews must use it and must not add inline handlers, remote origins or hard-coded colors.

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

| Surface                 | First-slice role                                                       |
| ----------------------- | ---------------------------------------------------------------------- |
| Activity Bar / Side Bar | Mission, project and progress entry points.                            |
| Editor                  | Textual projection first, with canonical node range mapping.           |
| World Preview           | Webview-friendly frame data rendered from mission/runtime/world state. |
| Execution Inspector     | Current node, statement type and before/after world state.             |
| AI proposal review      | Inspect, reject or explicitly apply structured proposals.              |

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

## Canvas editor slice

The Studio canvas editor is an IDE-native visual projection of the canonical program. It renders from
`@agorix/block-editor` workspace projection data and writes only through canonical workspace
transactions that validate back to `ProjectProgram`. The generated code projection remains visible
beside the canvas, and World Preview / Execution Inspector continue to derive from the accepted
program rather than canvas-local state.

POC accessibility limit: the canvas exposes keyboard-focusable block buttons and toolbar actions, but
it does not yet implement a full spatial keyboard reordering model or screen-reader equivalent for
all future drag/drop gestures. Those gaps must stay documented until a later accessibility slice
adds parity controls.

## #121 handoff

This slice provides deterministic fixture semantics:

- a Web-created stored project can be opened and projected in Studio;
- Studio can produce an explicitly applied modified stored project;
- #121 should verify the modified fixture reopens in Web without semantic drift.
