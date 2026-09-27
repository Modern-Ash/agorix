# Requirements

## Functional Requirements

- R1: The First Mission must be editable using touch-only interactions.
- R2: The First Mission must be editable without drag.
- R3: Reorder must work reliably through explicit controls and keyboard-accessible actions.
- R4: The Action Palette must remain contextual and must not obscure required World, Code, or active editing context.
- R5: Orientation change during editing must preserve canonical program state and visible generated code.
- R6: Numeric input must remain usable when the virtual keyboard is present; primary commit/cancel or equivalent controls must not be hidden.
- R7: Interaction must work in English and Spanish.
- R8: Automated tests must cover key touch paths.
- R9: Stylus compatibility must be documented as future-compatible without making stylus required.
- R10: Critical actions must not be hover-only, gesture-only, or mouse-only.

## Implementation Requirements

- R11: Preserve the #118 tablet-first World + Code hierarchy.
- R12: Preserve canonical program invariants from `AGENTS.md`; visual cards and generated code remain projections of canonical state.
- R13: Preserve existing runtime, persistence, locale and deterministic Learning Companion behavior.
- R14: Use #117 design-system component grammar for Action Palette, Touch Controls and Visual Instruction/Card behavior.

## Non-goals

- No freehand drawing to code.
- No AI-generated program mutation.
- No full replacement of the editor model.
- No formal accessibility certification beyond automated and deterministic checks.
