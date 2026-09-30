# TypeScript LanguageProjection migration

Issue #82 promotes the existing educational TypeScript/JavaScript-like generator to the
official `LanguageProjection` id `typescript`.

## Compatibility

The learner-visible output is unchanged.

Legacy APIs remain available:

- `projectProgram()` keeps returning `{ code, mapping }`;
- `projectProgramLanguage()` returns the shared LanguageProjection result;
- `TYPESCRIPT_LIKE_PROJECTION` aliases `TYPESCRIPT_PROJECTION`;
- `typescriptLikeProjection` aliases `typescriptProjection`.

This lets current Web block/code highlighting continue using the same text ranges while new
multi-language surfaces select the projection by `typescript`.

## Authority

TypeScript text remains a read-only deterministic projection of the canonical program. It is
not independently executed, does not own program state and has no runtime, UI or AI/provider
dependency.

## Before / after

Before #82:

```text
canonical program -> code-generator -> typescript-like
```

After #82:

```text
canonical program -> LanguageProjection registry -> typescript
                                      |
                                      +-> legacy code-generator API
```

The emitted source text and node mappings remain byte-compatible with existing fixtures.
