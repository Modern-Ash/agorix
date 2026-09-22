---
schema: "agora/unit-of-work/v1"
id: "issue-11-monorepo-toolchain"
intent: "issue-11"
work: "monorepo-toolchain/monorepo-skeleton"
source: "https://github.com/Modern-Ash/agorix/issues/11"
---

# Unit of work: Issue #11 monorepo and toolchain

## Scope

Stand up the pnpm workspace skeleton and engineering toolchain from
SYSTEM_DESIGN.md, with placeholder (not implemented) domain logic — this issue
creates the skeleton other issues (#12 onward) fill in.

## In scope

- pnpm workspace root: `pnpm-workspace.yaml`, root `package.json` (packageManager,
  engines, scripts: `lint`, `test`, `build`, `ci`).
- `apps/web` (React + Vite shell), `apps/tutor-api` (minimal Node/TS server shell,
  no real LLM call), `apps/mobile` (Capacitor config placeholder).
- `extensions/vscode` (placeholder directory with a README stub).
- 9 packages under `packages/`: program-model, block-editor, runtime, stage,
  code-generator, curriculum, tutor-contract, persistence, platform-contract — each
  with a minimal `package.json`, `tsconfig.json` extending the shared root config,
  an `src/index.ts` placeholder export, and a `README.md` stating its
  responsibility per SYSTEM_DESIGN.md.
- Shared `tsconfig.base.json` (strict mode) at the root.
- ESLint flat config + Prettier config at the root, applied workspace-wide.
- Vitest configured at the root/workspace level; one placeholder test per package
  proving the toolchain runs.
- Playwright skeleton (config + one placeholder spec) under `apps/web`.
- Root README developer bootstrap section (clone, install, run, test, build).

## Out of scope

- Any real domain logic (canonical program schema is issue #12; interpreter is
  issue #14; etc.) — packages export placeholders only.
- Real GitHub Actions CI wiring (issue #29) — this issue only needs the `pnpm ci`
  command to exist and pass locally.
- Blockly/Phaser integration (issues #17, part of #19/#20) — dependencies may be
  declared in `block-editor`/`stage` package.json but not wired into working code.

## Source material

- docs/architecture/SYSTEM_DESIGN.md — repository layout, dependency direction,
  domain-package boundaries.
- AGENTS.md — architecture invariants (TypeScript first, domain packages don't
  import UI/platform SDKs).
- docs/delivery/AGENTIC_DEVELOPMENT.md — visibility requirements or PR provenance.

## Dependencies

None blocking — this is the first code issue; issues #12-#31 depend on it.
