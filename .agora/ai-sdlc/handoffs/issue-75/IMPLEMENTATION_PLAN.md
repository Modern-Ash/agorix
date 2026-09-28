# Implementation plan - issue #75

1. Create `packages/proposals` with package metadata, tsconfig, source and tests.
2. Implement schema constants, error class and validation/parsing.
3. Implement initial bounded operation set: append statement, replace statement, remove statement and replace statement field.
4. Implement semantic hash/stale checks using persistence helpers.
5. Implement review/diff/view-model/audit helpers.
6. Refactor Studio core proposal functions to delegate to `@agorix/proposals`.
7. Add package dependencies to Studio and Web package manifests.
8. Run format, lint, build, tests and Agora verification.
