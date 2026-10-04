# ADR 0006: Studio Agent and canvas projection

## Status

Accepted for epic #242 (issue #243).

## Context

Studio (#204) shipped as a code-first, IDE-native surface. Its epic stated: do not copy the Web block editor into VS Code as Studio's primary experience. #196 owns Web interaction (palette, blocks, drag/drop, touch).

Product direction for the advanced surface has since sharpened: Studio should feel like a visual IDE tool (canvas, icon-first side bars, component toolbar) and be **AI-native**, with a proactive agent that teaches learners to direct and audit AI work. The current Learning Companion in Studio is a text tree and does not carry that role.

## Decision

1. **Canvas is a projection, not a second editor of record.** Studio adds a custom-editor canvas rendered from the canonical `ProjectProgram` (via `@agorix/block-editor` projection) and edited only through canonical transactions (#191). It opens beside the code editor, World Preview and Inspector. It does not own state.
2. **Not the Web editor.** The Studio canvas is IDE-native: VS Code custom editor/webview, icon-first palette, keyboard-first, native Undo/Redo, split-editor layout, IDE density. #196 remains the owner of the Scratch-familiar, touch-first Web editor. They share the toolbox vocabulary (`ToolboxBlockDefinition`) and the canonical program, nothing else.
3. **Code stays visible.** The code editor remains available in normal flow, so the AGENTS.md invariant "code is continuously visible" holds.
4. **Agent is ambient plus intent bar, not chat.** See `docs/product/STUDIO_AGENT.md`.
5. **Director/Auditor pedagogy** is the paradigm for AI-assisted work in Studio.
6. **Cost control through the existing decision plane.** System 0, then LAYA, then `routeLearningRequirements`; provider only when `generativeNeeded` is yes. No new routing authority is introduced.
7. **Provider access stays behind the server/provider-adapter boundary.** The extension holds no provider SDK and no embedded credentials.

## Amendment to #204

The #204 line "Do not copy the Web block editor into VS Code as Studio's primary experience" stays true: the canvas is not the Web editor and is not the primary surface by itself. What changes is that Studio now includes a visual canvas projection as one of its co-equal editors. Studio parity docs (`AGORIX_STUDIO.md`, `STUDIO_RELEASE_GATE.md`) reference this ADR.

## Consequences

- Canvas, code and ghost proposal nodes can never diverge in semantics; tests assert the semantic hash after edit sequences.
- Web and Studio share one block vocabulary, so a new block appears in both.
- The agent can be shipped, evaluated and costed independently of the canvas (Phase 1 before Phase 2).
- Accessibility limits of spatial canvases (see `ACCESSIBILITY_LIMITATIONS` in block-editor) must be documented and mitigated by keyboard paths and the code projection.
- Telemetry is bounded to non-PII fields defined in STUDIO_AGENT.md.
