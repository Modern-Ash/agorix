# @agorix/platform-contract

Boundary for capabilities that differ across web, mobile and VS Code: filesystem access, persistence backend, sharing/export, native integrations.

Domain package: must not import React, Blockly, Phaser, Capacitor, VS Code APIs or
provider SDKs (see `AGENTS.md` architecture invariants and
`docs/architecture/SYSTEM_DESIGN.md`). Placeholder scaffold from issue #11; real
domain logic lands in later issues.
