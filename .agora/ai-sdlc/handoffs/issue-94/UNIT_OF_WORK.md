# Issue 94 Unit Of Work

## Unit

Deliver the OpenAI-compatible gateway adapter in `@agorix/provider-runtime`, with deterministic tests and setup documentation.

## Primary Files

- `packages/provider-runtime/src/index.ts`
- `packages/provider-runtime/src/index.test.ts`
- `packages/provider-runtime/README.md`
- `docs/providers/OPENAI_COMPATIBLE_GATEWAY.md`

## Inputs

- Provider runtime contract from #92.
- Ollama adapter patterns from #93.
- GitHub issue #94 acceptance criteria.

## Outputs

- Configurable OpenAI-compatible gateway runtime factory.
- Optional auth support.
- Deterministic mock-based tests.
- Documentation for at least two compatible deployment classes.
