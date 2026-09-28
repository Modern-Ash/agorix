# ADR 0001: LanguageProjection contract

## Status

Accepted for issue #79.

## Context

Agorix currently has one TypeScript/JavaScript-like educational code generator in
`@agorix/code-generator`. The product direction in #65 requires Blocks, Agorix
Code, Python, TypeScript and future language packs to display the same canonical
program without creating separate program authority per language.

## Decision

Introduce `@agorix/language-projection` as a platform-neutral contract package.
A `LanguageProjection` consumes `ProjectProgram` and returns:

- projection id and version;
- deterministic display text;
- canonical node id to one or more half-open text ranges;
- structured diagnostics for unsupported nodes;
- optional structural metadata.

Projection text is display/learning output. Runtime execution continues to use
the canonical program. Projection packages must not import React, Blockly,
Phaser, VS Code APIs, Capacitor APIs or provider SDKs.

`@agorix/code-generator` remains as the current TypeScript-like implementation
and now exposes `projectProgramLanguage()` plus `typescriptLikeProjection`, while
preserving the legacy `projectProgram()` result shape for existing consumers.

## Consequences

- #80, #81 and #82 can implement projections against the shared contract.
- UI surfaces can discover projections by id/descriptor without owning domain
  semantics.
- Node-to-text highlighting can remain language-independent at the API boundary.
- Unsupported canonical nodes fail explicitly through diagnostics or the existing
  legacy `UnsupportedNodeError` path.
