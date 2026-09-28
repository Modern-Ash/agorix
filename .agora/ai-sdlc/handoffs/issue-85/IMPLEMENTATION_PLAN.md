# Issue 85 Implementation Plan

1. Add `@agorix/proposals` as a workspace dependency of `@agorix/tutor-contract` so builder capability can reuse the canonical ProgramProposal model.
2. Add `packages/tutor-contract/src/learning-companion.ts` with schema constants, types, validators, parser helpers, provider conformance helper, migration helpers and deterministic fake responses.
3. Reexport Learning Companion APIs from `packages/tutor-contract/src/index.ts`.
4. Extend `packages/tutor-contract/src/index.test.ts` with migration, capability, fail-closed, provider-neutrality and dependency hygiene coverage.
5. Update `packages/tutor-contract/README.md` and add ADR `docs/architecture/adr/0004-learning-companion-contract.md`.
6. Run lint, tests and build.
