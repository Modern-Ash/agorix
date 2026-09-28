# Intent interpretation

Build the first Agorix Studio slice as a VS Code extension surface that reuses Agorix shared
contracts rather than creating a second product model.

The source issue is intentionally broad. The first approved construction should establish the
Studio extension package, shared project loading, textual projection, World Preview state, execution
evidence and explicit ProgramProposal review boundaries. Later breadth such as full IDE workflows,
Git concepts and complete Web/Studio round-trip UX can build on that foundation.

## Source facts

- Parent epic: #116.
- Product role: Agorix Studio is the advanced/progressive desktop surface.
- Studio must reuse canonical program, runtime, curriculum, LanguageProjection, Learning Companion,
  ProgramProposal and project format.
- Studio must feel like a VS Code extension, not Scratch embedded in VS Code.
- VS Code API imports must be isolated to extension/adapters.
- Studio may work without a remote AI provider.
- #121 owns full cross-surface compatibility proof after Web and Studio can both read/write the
  shared project contract.

## Proposed interpretation

- Treat #38 construction as the first Studio slice, not the full future Studio product.
- Add/activate `extensions/vscode` as a workspace package.
- Keep domain logic in shared packages or extension-local pure modules; isolate `vscode` imports at
  the extension boundary.
- Use existing `@agorix/persistence`, `@agorix/code-generator`, `@agorix/runtime`, `@agorix/stage`
  and `@agorix/curriculum` contracts.
- Prepare Web-created and Studio-modified fixtures that #121 can use for the full compatibility
  proof.
