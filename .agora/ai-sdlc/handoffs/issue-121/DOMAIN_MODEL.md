# Domain model - issue #121

## Entities

- Canonical Project: `StoredProject` with `schemaVersion`, `program`, and `metadata`.
- Canonical Program: validated `ProjectProgram`; the only program authority across Web, Tablet and Studio.
- Semantic Snapshot: deterministic comparison payload containing contract version, schema version, program, `missionProgress`, and `hintLevel`.
- Presentation State: selected panel, editor split, theme, focus, tablet orientation, selected projection and locale preferences. It is outside program semantics.
- Surface: Web, Tablet or Studio reader/writer of the same canonical project envelope.

## Invariants

- The semantic hash is identical after Web -> Studio -> Web round trips when no semantic edit occurs.
- Studio edits are persisted as canonical program edits, not as editor-specific patches.
- Unsupported newer schemas fail explicitly with `UNKNOWN_VERSION`.
- UI-specific identifiers do not appear under `program`.
- Locale and selected projection are explicit preferences and do not alter the semantic hash.
