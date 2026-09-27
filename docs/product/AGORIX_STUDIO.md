# Agorix Studio architecture

## Purpose

Agorix Studio is the VS Code surface for learners who are ready to work closer to code, debugging evidence and software-development practices. It reuses the same canonical program, runtime, curriculum, LanguageProjection, Learning Companion and ProgramProposal boundaries as Web.

Studio is not Scratch embedded in VS Code. It is an IDE-native learning surface that keeps the accepted program, code projection, runtime evidence and proposal review distinct.

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

## #121 handoff

This slice provides deterministic fixture semantics:

- a Web-created stored project can be opened and projected in Studio;
- Studio can produce an explicitly applied modified stored project;
- #121 should verify the modified fixture reopens in Web without semantic drift.
