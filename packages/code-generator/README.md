# @agorix/code-generator

Projects canonical program state (`@agorix/program-model`) into readable
TypeScript/JavaScript-like educational code and node→text mappings for UI
highlighting.

- Pure, deterministic `projectProgram(program) → { code, mapping }`.
- Explicit `UnsupportedNodeError` for unknown node types.
- Generated text is display-only in the POC — never executed by the runtime.

Domain package: must not import React, Blockly, Phaser, Capacitor, VS Code APIs
or provider SDKs (see `AGENTS.md` architecture invariants and
`docs/architecture/SYSTEM_DESIGN.md`).
