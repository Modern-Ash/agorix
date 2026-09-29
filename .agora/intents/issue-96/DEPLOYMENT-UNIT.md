<!-- agora-ai-sdlc:construction/v1 -->

# Deployment Unit — issue-96

No new deployment target. `@agorix/provider-runtime` is a pure TypeScript
library package; this change adds one new source file and its tests, with
no new dependency, secret, environment variable, or network call — health
checks and provider requests were already the existing Ollama/OpenAI-
compatible adapters' responsibility (issues #93/#94), unchanged here.
