---
schema: "agora/implementation-plan/v1"
id: "issue-11-monorepo-toolchain"
work: "monorepo-toolchain/monorepo-skeleton"
---

# Implementation plan: monorepo skeleton

1. Read SYSTEM_DESIGN.md, AGENTS.md, AGENTIC_DEVELOPMENT.md.
2. Scaffold directories: `apps/{web,tutor-api,mobile}`, `extensions/vscode`,
   `packages/{9 domain packages}`.
3. Root config: `pnpm-workspace.yaml`, `package.json` (engines, packageManager,
   scripts), `.nvmrc`, `tsconfig.base.json` (strict mode), `eslint.config.js`
   (flat config + domain-package import restriction), `.prettierrc.json`.
4. Per-package: minimal `package.json`, `tsconfig.json` extending the base,
   `README.md` (responsibility per SYSTEM_DESIGN.md), placeholder `src/index.ts` +
   `src/index.test.ts`.
5. `apps/web`: React + Vite shell importing `@agorix/program-model` (R3), Vitest
   config excluding `e2e/**`, Playwright config + skeleton spec.
6. `apps/tutor-api`: minimal shell importing `@agorix/tutor-contract`, no provider
   call.
7. Root `README.md`: developer bootstrap section + repository layout (R6).
8. Install, then iteratively fix real toolchain failures found by running the
   commands (not by inspection alone):
   - ESLint flagged `.venv` (Python vendor JS) — added to `ignores`.
   - Module-type warning — added `"type": "module"` to root `package.json`.
   - Vitest collected the Playwright spec — scoped `apps/web`'s Vitest config to
     exclude `e2e/**`.
   - `tsc` failed on JSX/DOM types in `apps/web` — added `@types/react`,
     `@types/react-dom`, and `DOM`/`DOM.Iterable` to that project's `lib`.
   - `pnpm ci` is a reserved pnpm command, not a runnable script name — renamed
     the contract script to `verify` (R5), documented as `pnpm run verify`.
9. Grep the 8 restricted domain packages' `src/` for forbidden imports (R4) —
   zero matches.
10. Run `pnpm run verify` end-to-end as final evidence (R1, R2, R5 together).

Executed by `project:ai-runtime-2` (developer) in this session. Unlike the prior
docs-only cycles (#9, #10, #32), every step here was verified by actually running
the toolchain, and three real defects were found and fixed in the process (module
type warning, Vitest/Playwright collision, missing React types, `pnpm ci`
name collision) rather than assumed correct from source reading alone.
