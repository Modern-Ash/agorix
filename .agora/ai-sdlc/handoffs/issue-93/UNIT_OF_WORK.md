# Issue 93 Unit Of Work

## Unit

Deliver an Ollama provider runtime adapter and supporting documentation for the Learning Companion provider boundary.

## Primary Files

- `packages/provider-runtime/src/index.ts`
- `packages/provider-runtime/src/index.test.ts`
- `packages/provider-runtime/README.md`
- `docs/architecture/SYSTEM_DESIGN.md`
- Optional new setup guide under `docs/`

## Inputs

- `@agorix/provider-runtime` from #92
- `@agorix/tutor-contract` Learning Companion contract from #85
- GitHub issue #93 acceptance criteria

## Outputs

- Configurable Ollama adapter factory.
- Contract tests with fetch injection or deterministic test doubles.
- Optional gated integration test behavior when real Ollama is absent.
- Setup documentation for local Ollama use.

## Done Boundary

Construction is complete only when unit tests, typecheck, lint and build pass, and the GitHub PR is ready for human merge. Operations and Product Owner acceptance remain separate governed gates.
