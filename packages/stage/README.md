# @agorix/stage

Framework-neutral stage state and commands; Phaser is the first renderer/adapter, not the domain authority.

Domain package: must not import React, Blockly, Phaser, Capacitor, VS Code APIs or
provider SDKs (see `AGENTS.md` architecture invariants and
`docs/architecture/SYSTEM_DESIGN.md`). Placeholder scaffold from issue #11; real
domain logic lands in later issues.
