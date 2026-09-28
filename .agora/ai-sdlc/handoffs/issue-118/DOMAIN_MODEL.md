# Domain Model

## UI regions

- Mission chrome: compact mission title, learner-facing goal, locale selector, run controls, progress rail and execution status.
- World surface: visual runtime state for sprite, goal and runtime evidence.
- Code surface: generated textual projection from the canonical program; visible in normal tablet landscape and portrait flows.
- Program builder: accepted block sequence and numeric fields derived from canonical editor state.
- Action Palette: contextual block insertion surface replacing the permanent left toolbox.
- Learning Companion: contextual hint/proposal surface grounded in mission, canonical program and runtime evidence.

## State invariants

- Canonical program state remains owned by `EditorModel.program`.
- Workspace blocks and generated code derive from the canonical program/editor projection.
- Locale remains metadata/presentation state and must not enter canonical program payloads.
- Runtime evidence comes from `runProgram` observations.
- Learning Companion output remains a proposal/explanation and never mutates canonical program state directly.
