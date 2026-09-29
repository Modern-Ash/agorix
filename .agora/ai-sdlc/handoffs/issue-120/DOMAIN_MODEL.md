# Domain Model

## Interaction entities

- Action Palette: contextual command surface for adding program actions.
- Program Card: manipulable visual representation of one canonical block/node.
- Numeric Edit Session: transient UI state for editing a numeric block field before explicit apply/cancel.
- Reorder Command: explicit up/down command that changes canonical program order.
- Input Mode: touch, keyboard, pointer, virtual keyboard or optional stylus.

## Invariants

- Canonical program remains in `EditorModel.program`.
- Action Palette inserts through existing editor model projections.
- Reorder updates canonical order through existing editor model projections.
- Numeric draft values are local UI state until applied.
- Drag is not required for First Mission editing.
- Stylus does not create code or alter the canonical program in this issue.
