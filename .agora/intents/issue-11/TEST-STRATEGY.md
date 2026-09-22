---
schema: "agora/test-strategy/v1"
id: "issue-11-monorepo-toolchain"
work: "monorepo-toolchain/monorepo-skeleton"
---

# Test strategy: monorepo skeleton

Unlike #9/#10/#32 (documentation deliverables), this is real code — every check
below is a command that was actually run, with its actual output captured, not a
prose self-assessment.

## Checklist (= test suite)

| Check | Requirement | Command | Result |
| --- | --- | --- | --- |
| Clean install | R1 | `pnpm install` (and re-run with `--frozen-lockfile`) | pass — exit 0 |
| Lint | R2 | `pnpm lint` | pass — 0 errors, 0 warnings |
| Unit tests | R2 | `pnpm test` | pass — 11/11 test files, 11/11 tests |
| Build | R2 | `pnpm build` | pass — 12/12 workspace projects (11 with a build script) |
| Web imports domain package | R3 | `apps/web/src/App.tsx` imports `@agorix/program-model`; `App.test.tsx` asserts the imported value; `pnpm build` resolves it under Vite/tsc | pass |
| Domain packages have no forbidden imports | R4 | `grep -rE "from [\"'](react\|react-dom\|blockly\|phaser\|@capacitor\|vscode\|openai\|@anthropic-ai)"` across the 8 restricted packages' `src/`, plus ESLint's `no-restricted-imports` rule scoped to the same paths | pass — 0 matches, 0 lint errors |
| Single CI command contract | R5 | `pnpm run verify` (install --frozen-lockfile && lint && test && build) | pass — full pipeline green |
| README developer bootstrap | R6 | manual read-through of `README.md`'s new "Developer bootstrap" section against a clean clone | pass |

8 of 8 checks pass (R1-R6, with R2 and R3/R4 each covered by more than one check).

## Known deviation

Node in the execution environment is 20.19.0; `.nvmrc`/`engines` declare 22 (the
clarified decision). `pnpm install`/`lint`/`test`/`build` all succeed under Node 20
with a non-fatal `Unsupported engine` warning — recorded here rather than silently
changing the pinned version, since 22 remains the intended target and CI (issue
#29) should pin the matching runner.

## Security scan (real, not placeholder)

`pnpm audit` initially found 7 vulnerabilities (1 critical: Vitest UI arbitrary
file read <3.2.6; 1 high: Vite `server.fs.deny` bypass; 5 moderate, all
transitive through `vitest`/`vite`/`esbuild` dev tooling). Fixed by bumping
`vitest` 2.1→4.1.11 and `apps/web`'s `vite` 5.4→7.1 (vitest 4 requires vite
6/7/8). Test suite grew from 11 to 21 passing tests after the bump (vitest 4's
project reporting is more granular; no test content changed). Re-ran `pnpm audit`:
**0 known vulnerabilities**.

## Result

success — 8/8 requirement checks pass, 0 fail; 1 known/documented Node version
deviation; security scan found and fixed 7 real vulnerabilities (not simulated).
