# Requirements

## Functional Requirements

- R1: The shell must prioritize World and Code as persistent primary regions in tablet landscape.
- R2: The shell must keep World and Code visible/inspectable in tablet portrait, with Code directly after World in normal flow.
- R3: Mission/progress must become compact chrome and must not compete with World/Code for the main viewport.
- R4: Block/action insertion must be available through a contextual Action Palette or bottom sheet rather than a permanent major-width left toolbox.
- R5: Learning Companion help must be contextual and must not require a permanent full-height tutor panel for normal flow.
- R6: Run, Stop, Reset and any available Step control pattern must be touch-friendly and keyboard reachable.
- R7: Orientation changes between representative portrait and landscape tablet sizes must preserve canonical program state and generated code.
- R8: Virtual keyboard and narrow layouts must not hide or destroy access to critical controls.
- R9: No essential interaction may be hover-only.
- R10: Existing persistence, locale switching, deterministic runtime, generated code and deterministic tutor behavior must keep working.

## Implementation Requirements

- R11: New shell styles should use semantic Agorix tokens aligned with `docs/product/DESIGN_SYSTEM.md`.
- R12: Playwright must validate tablet landscape and portrait capability classes listed by the issue.
- R13: Tests must prove Code remains visible in both orientations.
- R14: Accessibility requirements from `docs/product/UX_REQUIREMENTS.md` must remain valid for run controls, focus, contrast, target sizes and code readability.

## Non-goals

- Do not build new AI provider integrations.
- Do not change canonical program semantics.
- Do not make Code advanced-only.
- Do not claim full screen-reader support for Blockly beyond existing documented POC limitations.
