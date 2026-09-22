---
schema: "agora/requirements/v1"
id: "issue-11-monorepo-toolchain"
intent: "issue-11"
work: "monorepo-toolchain/monorepo-skeleton"
source: "https://github.com/Modern-Ash/agorix/issues/11"
---

# Requirements: Issue #11 monorepo and toolchain

Each requirement maps 1:1 to one of issue #11's six acceptance checkboxes.

## R1 — Clean install succeeds

`pnpm install` from a clean clone (no existing `node_modules`) completes with exit
code 0.

## R2 — Root lint/test/build succeed

`pnpm lint`, `pnpm test` and `pnpm build` (and the combined `pnpm ci`) each exit 0
across the whole workspace.

## R3 — Shared packages importable from web

`apps/web` can `import` from at least one `packages/*` package (e.g.
`@agorix/program-model`) via the pnpm workspace protocol, and that import resolves
under the app's TypeScript/Vite build.

## R4 — Domain packages have no UI/platform SDK imports

None of `program-model`, `runtime`, `stage`, `curriculum`, `code-generator`,
`tutor-contract`, `persistence`, `platform-contract` import `react`, `blockly`,
`phaser`, `@capacitor/*`, `vscode`, or any LLM provider SDK — checked by a grep/lint
rule, not just manual inspection.

## R5 — One CI command contract exists

A single root script runs install (frozen lockfile) + lint + test + build with one
pass/fail exit code. Named `verify` rather than `ci`, since `pnpm ci` is a reserved
pnpm command (discovered during construction) that shadows a same-named script;
invoked as `pnpm run verify`.

## R6 — README developer bootstrap documented

The root `README.md` documents: prerequisites (Node version, pnpm via Corepack),
clone, install, run web app locally, run tests, run lint, run build — a new
contributor can follow it without asking for missing steps.

## Traceability

R1-R6 trace 1:1 to issue #11's acceptance checklist. Evidence of satisfaction is
real command output (not doc-equivalent): `pnpm install`, `pnpm lint`, `pnpm test`,
`pnpm build`, `pnpm ci`, and a grep/lint check for R4, plus product-owner review of
the README.
