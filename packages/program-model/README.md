# @agorix/program-model

Canonical, serializable AST-like representation of learner programs and shared
creative project state.

Domain package: must not import React, Blockly, Phaser, Capacitor, VS Code APIs or
provider SDKs (see `AGENTS.md` architecture invariants and
`docs/architecture/SYSTEM_DESIGN.md`).

## Shared Creative Core

`ProjectProgram` remains the runtime program: scripts, triggers, statements,
variables and expressions. Scratch-like project state that is not executable code
is modeled beside it as `ProjectCreativeState`:

- `assets`: canonical references for costumes, backdrops and future sounds.
- `actors`: stable sprite-like entities with position, direction, size,
  visibility, costume and owned script ids.
- `stage`: backdrop, viewport dimensions and actor ordering.

This deliberately avoids a `ProjectProgram` v2 until the executable language
itself needs a schema break. App and Studio persist the creative state in
project metadata, but validation lives here so both surfaces share one reference
model. UI state, ownership, account identity, provider traces and editor-only ids
must stay outside both `ProjectProgram` and `ProjectCreativeState`.
