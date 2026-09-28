# Logical design - issue #121

## Shared compatibility helper

`packages/persistence/src/compatibility.ts` provides platform-neutral helpers:

- `semanticProjectSnapshot` creates the deterministic comparison payload.
- `semanticProjectHash` produces a stable SHA-256 hash for compatibility evidence.
- `assertSemanticallyEquivalentProjects` fails when surface round trips change semantics.
- `assertNoUiSpecificProgramState` rejects known UI state keys inside canonical program JSON.
- `assertCrossSurfaceCompatibleProject` validates the program and leakage boundary together.

## Surface proof

`extensions/vscode/src/crossSurfaceCompatibility.test.ts` uses the Web persistence abstraction (`ProjectStore`) and Studio core APIs (`openStoredProject`, `createStoredProjectWithProgram`, `parseStoredProject`) to prove the required bidirectional flow without browser or VS Code runtime coupling.

## Documentation

`docs/product/CROSS_SURFACE_COMPATIBILITY.md` defines serialization rules, migration policy, presentation-state boundaries and required automated proof. `docs/product/AGORIX_STUDIO.md` links Studio to that contract.
