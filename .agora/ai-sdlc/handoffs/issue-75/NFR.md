# Non-functional requirements - issue #75

- NFR1: Fail closed for malformed, unknown, stale or invalid proposals.
- NFR2: Keep proposal domain code platform-neutral; no React, VS Code API, Blockly, provider SDK or browser-only imports.
- NFR3: Deterministic tests must not require provider credentials.
- NFR4: Use canonical validation and deterministic projection/diff logic instead of model prose.
- NFR5: Preserve accessibility/touch requirements from #120 for visible proposal actions.
- NFR6: Preserve design/provenance separation from #117/#74: proposal is provisional, not success/accepted state.
- NFR7: Maintain cross-surface semantics from #121: Web and Studio may render differently but must accept/reject to identical canonical semantics.
