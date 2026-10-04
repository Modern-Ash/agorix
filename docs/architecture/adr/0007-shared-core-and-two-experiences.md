# ADR 0007: Shared core and two experiences

## Status

Accepted. Amends ADR 0006.

## Context

Studio shipped as a code-first, tree-view surface and the Web app is block-first. The product direction is now a rich, graphical, agent-present Studio in the style of spec-driven tools, and a Web app that behaves like a Scratch native to AI, both on one core, shared free with institutions ([`FOUNDATIONS.md`](../../FOUNDATIONS.md), [`PUBLIC_BENEFIT.md`](../../product/PUBLIC_BENEFIT.md)).

## Decision

1. **Shell.** Studio stays a VS Code extension with webview/custom-editor UI, using only public APIs so the same VSIX runs in VS Code forks via Open VSX. A fork or standalone app is a later distribution option.
2. **Shared headless core.** Existing domain packages remain the core. Three new platform-neutral packages are added: `@agorix/interaction-core` (drag intents, anchors, keyboard parity), `@agorix/agent-workflow` (Director/Auditor state machine, assistance ladder, agent agreements) and `@agorix/studio-protocol` (versioned host/UI messages). They import no DOM, VS Code or provider code.
3. **UIs emit intents.** A UI never mutates the program. The host converts intents to canonical transactions.
4. **Agent panel is structured.** Amends ADR 0006 item 4: Studio may have an agent panel made of plan, tasks, proposals with diff and predictions. It is not a free-form transcript and free text is secondary.
5. **Studio no longer excludes block-style editing.** The canvas is a projection of the canonical program (ADR 0006) and a co-equal editor. `STUDIO_RELEASE_GATE.md` is updated accordingly.
6. **Educator tooling.** The `PRODUCT_INTENT.md` non-goal "classroom administration" is narrowed to administration and surveillance. Educator evidence export and deployment tools without PII are allowed.

## Consequences

- A new block, signal or agent mode appears in Web and Studio from one change.
- Web and Studio can be built in parallel against the core.
- The same edit sequence must yield the same semantic hash on both surfaces (cross-surface gate, later plan).
- Reordering of epic #242: anchors and canvas precede agent depth.
