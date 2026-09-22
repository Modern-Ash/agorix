---
schema: "agora/domain-model/v1"
id: "issue-11-monorepo-toolchain"
work: "monorepo-toolchain/monorepo-skeleton"
---

# Domain model: monorepo workspace graph

## Entities

- **Workspace project**: one `apps/*` or `packages/*` directory with its own
  `package.json`; 12 total (3 apps + 9 packages).
- **Domain package**: one of the 8 packages under `packages/` excluding
  `block-editor` at the ESLint-restricted-import boundary (program-model, runtime,
  stage, curriculum, code-generator, tutor-contract, persistence,
  platform-contract) — forbidden from importing UI/platform/provider SDKs.
- **Forbidden import**: one of react, react-dom, blockly, phaser, @capacitor/core,
  vscode, openai, @anthropic-ai/sdk — enforced by `eslint.config.js`'s
  `no-restricted-imports` rule scoped to domain-package `src/**`.

## Relationships

- `apps/web` → depends on `@agorix/program-model` (workspace:*), proving R3
  (shared packages importable from web).
- `apps/tutor-api` → depends on `@agorix/tutor-contract` (workspace:*), matching
  SYSTEM_DESIGN.md's "tutor-api ... only component allowed to call an external LLM
  provider".
- Each domain package → its own `tsconfig.json` extending the shared
  `tsconfig.base.json` (strict mode inherited, not restated).
- Root `verify` script → composes `install --frozen-lockfile`, `lint`, `test`,
  `build` as the single CI command contract (R5).
