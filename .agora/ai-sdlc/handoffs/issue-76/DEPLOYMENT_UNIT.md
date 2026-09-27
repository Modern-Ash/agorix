# Deployment Unit - issue #76

No new service or deployment target is introduced. The deployable unit is the existing monorepo packages and Web/Studio surfaces:

- `@agorix/stage` exports the shared Step contract;
- `@agorix/web` consumes it in the learner UI;
- `@agorix/vscode-extension` consumes it in Studio execution evidence.

Release path remains the existing repository CI and Web/extension packaging flow.
