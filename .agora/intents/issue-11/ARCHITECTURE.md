---
schema: "agora/architecture/v1"
id: "issue-11-monorepo-toolchain"
work: "monorepo-toolchain/monorepo-skeleton"
---

# Architecture: monorepo skeleton

## Layout (as built)

```
apps/web              React 18 + Vite, imports @agorix/program-model, Vitest + Playwright configured
apps/tutor-api         Minimal Node/TS shell, imports @agorix/tutor-contract, no provider call
apps/mobile            Placeholder (README only) — Capacitor config lands in issue #37
extensions/vscode       Placeholder (README only) — real extension lands in issue #38
packages/program-model  Domain package, placeholder export
packages/block-editor   Domain package (not import-restricted at the ESLint level, since
                         its whole job is to depend on Blockly — see note below)
packages/runtime        Domain package, placeholder export
packages/stage          Domain package, placeholder export
packages/code-generator Domain package, placeholder export
packages/curriculum     Domain package, placeholder export
packages/tutor-contract Domain package, placeholder export
packages/persistence    Domain package, placeholder export
packages/platform-contract Domain package, placeholder export
```

**Note on `block-editor`**: SYSTEM_DESIGN.md's constraint list groups "domain
packages" as not importing Blockly, but `block-editor`'s stated responsibility
("Maps visual blocks to/from program-model") requires depending on Blockly by
definition — it is the adapter, not the prohibited leakage point. The ESLint
`no-restricted-imports` rule (R4) is therefore scoped to the other 8 packages only;
`block-editor`'s constraint is "Blockly-specific identifiers do not leak into
domain documents" (SYSTEM_DESIGN.md), which is a naming/API-surface discipline for
issue #17 to satisfy, not an import ban.

## Toolchain

- pnpm workspace (`pnpm-workspace.yaml`: `apps/*`, `packages/*`).
- Shared `tsconfig.base.json` (strict, ES2022, noUncheckedIndexedAccess,
  exactOptionalPropertyTypes) — every project's `tsconfig.json` extends it.
- ESLint flat config (`eslint.config.js`) with `typescript-eslint` recommended
  rules, `eslint-config-prettier` (no stylistic conflicts with Prettier), and the
  domain-package import restriction.
- Prettier (`.prettierrc.json`) — formatting only, not linting.
- Vitest workspace (`vitest.workspace.ts`) — one test file per package proves the
  toolchain runs; `apps/web` additionally excludes `e2e/**` from its Vitest scope
  (Playwright owns that directory).
- Playwright (`apps/web/playwright.config.ts` + `e2e/smoke.spec.ts`) — skeleton
  only, real learner-journey E2E coverage is issue #31.

## Consumption

- Issues #12-#16 (program-model, interpreter, validation, projection) fill in
  `packages/program-model`, `packages/runtime`, `packages/code-generator`.
- Issue #17 (Blockly adapter) fills in `packages/block-editor`.
- Issues #18-#24 (blocks, editor shell, mission) build on `apps/web`.
- Issues #25-#27 (tutor) fill in `packages/tutor-contract` and `apps/tutor-api`.
- Issue #28 (persistence) fills in `packages/persistence`.
- Issue #29 (CI) wires `pnpm run verify` into GitHub Actions.

## Change boundary

Adding a 10th package or a 4th app is a new PR against this skeleton, not a change
to already-placed packages' responsibilities (those are fixed by SYSTEM_DESIGN.md).
