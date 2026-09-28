# Cross-surface compatibility contract

Issue #121 makes "one product, multiple surfaces" a testable invariant. Web,
Tablet and Studio may present different controls, panels and layouts, but they
share the same canonical project contract.

## Canonical project

The canonical project is `StoredProject` from `@agorix/persistence`:

- `schemaVersion` identifies the persisted project schema.
- `program` is the validated `ProjectProgram` from `@agorix/program-model`.
- `metadata.missionProgress` and `metadata.hintLevel` are learner progression
  state and participate in semantic equivalence.
- `metadata.locale` is an explicit user preference and does not change program
  semantics.

The semantic snapshot used for cross-surface comparison is versioned as
`agorix/cross-surface/v1`. Its hash includes schema version, canonical program
and learner progression. It excludes presentation state.

## Allowed presentation differences

These may differ between Web, Tablet and Studio:

- selected panel or inspector;
- editor split size;
- light or dark theme;
- Studio file/editor focus;
- tablet orientation;
- selected projection;
- locale.

Locale and selected projection must remain explicit user preferences. Switching
either one must not rewrite the canonical program or progression state.

## Forbidden canonical leakage

Surface identifiers must not be stored inside the canonical program. The
compatibility guard rejects keys such as `selectedPanel`, `editorSplitSize`,
`theme`, `studioFileFocus`, `tabletOrientation`, `blocklyId`, `selectedNodeId`
and `vscodeUri` when they appear under `program`.

Surfaces that need those values must persist them in surface-specific preference
storage or a clearly separated presentation envelope, not in `ProjectProgram`.

## Serialization and migration policy

All surfaces write the same `StoredProject` JSON shape. Loading rules are:

- the current `schemaVersion` opens directly after program validation;
- older versions require an explicit registered migration step;
- unsupported newer or unknown versions fail with `UNKNOWN_VERSION`;
- corrupted JSON fails with `CORRUPTED_DATA`;
- UI-specific state in canonical program state fails with `SCHEMA_MISMATCH`.

Silent coercion is not allowed. A surface must show a recoverable load failure
instead of mutating a project it cannot understand.

## Required automated proof

Compatibility tests must cover:

- Web-created project opens in Studio;
- Studio-created or modified canonical project reopens through Web persistence;
- Web to Studio to Web round trip preserves the semantic hash;
- unsupported future schema fails explicitly;
- presentation state and locale switches do not affect semantic equivalence;
- UI-specific identifiers do not leak into the canonical model.
