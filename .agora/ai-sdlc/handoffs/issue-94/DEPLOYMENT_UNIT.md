# Issue 94 Deployment Unit

## Unit

Workspace TypeScript package and documentation update.

## Runtime Impact

No hosted service, migration, external service dependency, OpenAI SDK, browser secret or credential-bearing UI is introduced. Consumers opt in by constructing `createOpenAICompatibleProviderRuntime` with explicit configuration.

## Release Surface

- `packages/provider-runtime/src/index.ts`
- `packages/provider-runtime/src/index.test.ts`
- `packages/provider-runtime/README.md`
- `docs/providers/OPENAI_COMPATIBLE_GATEWAY.md`

## Rollout

Merge through normal PR and CI. Existing fake and Ollama runtime paths remain available.
