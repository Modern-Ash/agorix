# Domain Model - issue #79

`LanguageProjection` is a pure read model over `ProjectProgram`. It contains a descriptor (`id`, `version`, `label`, optional `family`), deterministic `text`, language-neutral canonical node id mappings to one or more half-open ranges, structured diagnostics, and optional metadata.

`LanguageProjectionRegistry` stores projections by id and returns descriptors for discovery. It has no UI, provider, Blockly, Phaser, VS Code or Capacitor dependency.

`@agorix/code-generator` remains the current TypeScript-like projection implementation. Its legacy `projectProgram()` API is preserved while `projectProgramLanguage()` and `typescriptLikeProjection` expose the new contract.
