# Logical Design

## Web interaction design

- Keep the #118 tablet shell: World and Code remain the primary surfaces.
- Keep the Action Palette contextual and button-driven.
- Represent accepted visual instructions as cards with explicit controls.
- Add numeric edit sessions so virtual-keyboard users have Apply/Cancel controls near the focused field.
- Keep reorder as explicit Up/Down controls and test it as the no-drag path.

## Documentation design

Add `docs/product/INTERACTION_MODEL.md` as the durable source of truth for touch, drag, long press, virtual keyboard and stylus-compatible behavior.

## Test design

Extend Playwright with:

- complete First Mission via touch/no-drag path;
- reorder updates generated code;
- virtual-keyboard numeric edit controls;
- Spanish interaction path;
- existing tablet orientation/state tests preserved.
