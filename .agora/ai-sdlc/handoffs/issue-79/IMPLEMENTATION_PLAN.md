# Implementation Plan - issue #79

1. Create `packages/language-projection` with TypeScript types, registry and conformance helper.
2. Add independent demo projections in tests and verify they share the same conformance helper.
3. Adapt `packages/code-generator` to expose `typescriptLikeProjection` and `projectProgramLanguage()` without breaking existing consumers.
4. Add tests proving the legacy generator output maps exactly into the new contract.
5. Add architecture ADR and update system design package layout.
6. Run format, lint, build, unit tests and Agora verification.
