# @agorix/block-editor

Maps visual blocks to/from program-model; Blockly-specific identifiers do not leak into domain documents.

Domain package: must not import React, Blockly, Phaser, Capacitor, VS Code APIs or
provider SDKs (see `AGENTS.md` architecture invariants and
`docs/architecture/SYSTEM_DESIGN.md`). Placeholder scaffold from issue #11; real
domain logic lands in later issues.
