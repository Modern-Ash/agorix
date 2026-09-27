# Issue 93 Deployment Unit

## Unit

Workspace TypeScript package and documentation update.

## Runtime Impact

No hosted service, migration, secret, browser credential or bundled model is introduced. Consumers opt into Ollama by constructing `createOllamaProviderRuntime` with explicit endpoint, model and capabilities.

## Release Surface

- `packages/provider-runtime/src/index.ts`
- `packages/provider-runtime/src/index.test.ts`
- `packages/provider-runtime/README.md`
- `docs/providers/OLLAMA.md`

## Rollout

Merge through normal PR and CI. Deterministic fake runtime remains default, so existing editor/runtime paths are unchanged unless a consumer explicitly configures Ollama.
