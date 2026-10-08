# @agorix/runtime

Executes program-model deterministically and produces events/observations.

Domain package: must not import React, Blockly, Phaser, Capacitor, VS Code APIs or
provider SDKs (see `AGENTS.md` architecture invariants and
`docs/architecture/SYSTEM_DESIGN.md`).

## Multi-actor runtime

`runMultiActorProgram(program, creativeState, options)` executes the same
canonical `ProjectProgram` against shared creative project state from
`@agorix/program-model`.

The v1 scheduling model is deterministic:

- actors run in `stage.actorOrder` when present, otherwise in actor array order;
- each actor runs matching scripts from the shared event queue;
- an actor with no `scripts` field runs all `onStart` scripts for compatibility;
- a default `start` event is queued when callers do not provide events;
- `onKeyPressed`, `onActorClicked` and `onMessage` scripts run only when their
  queued event matches;
- `broadcast` appends message events after the statement trace entry;
- traces and frames include `actorId`, `scriptId` and canonical `nodeId`;
- every frame carries a full actor-state snapshot so App and Studio can render
  or inspect without runtime internals;
- broadcast loops stop at the shared execution budget.

## Variables and watchers

`program.variables` are seeded into the runtime world before execution. Variable
statements mutate the canonical world directly:

- `setVariable` writes a numeric value;
- `changeVariable` adds a numeric expression to the current value;
- `showVariable` and `hideVariable` control watcher visibility without changing
  the variable value.

Runtime expressions evaluate variables, arithmetic operators, comparisons,
boolean operators and seeded `random` deterministically. Invalid arithmetic, such
as division by zero, reports a runtime error instead of producing an unstable
value. Passing the same `randomSeed` to execution replays the same random
sequence.

Visible variable watchers are carried in `WorldState.variables` and included in
stage observations. The Web App and Studio render those observations as runtime
evidence; neither surface owns variable state.
