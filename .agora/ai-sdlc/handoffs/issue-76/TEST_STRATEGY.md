# Test Strategy - issue #76

- `pnpm --filter @agorix/stage test`: validates deterministic `ExecutionStep` timing, repeat/condition phases and frame mapping.
- `pnpm --filter @agorix/vscode-extension test`: validates Studio evidence includes the same canonical step sequence as preview frames.
- `pnpm --filter @agorix/web test`: validates Web shell still renders and i18n/catalog contracts hold.
- `pnpm --filter @agorix/web test:e2e`: validates Step synchronizes block/code/stage, cannot race with Run, preserves state across viewport changes and remains touch sized.
- `pnpm format:check`, `pnpm lint`, `pnpm build`, `pnpm test`, `aisdlc verify --run`: repository-level regression checks.
