# Verification Evidence

## Summary

Construction verification for issue #38 passed locally. The implementation adds the first Agorix Studio VS Code extension slice with shared project loading, textual projection mapping, execution evidence and explicit ProgramProposal review behavior.

## Environment note

Commands ran with Node v20.19.0. The repository declares `>=22 <23`, so pnpm emitted an engine warning. Commands completed successfully.

## Commands

- `pnpm install --no-frozen-lockfile` - passed and updated the lockfile for `extensions/vscode`.
- `pnpm install --frozen-lockfile` - passed after lockfile update.
- `pnpm --filter @agorix/vscode-extension build` - passed.
- `pnpm --filter @agorix/vscode-extension test` - passed: 1 test file, 5 tests.
- `pnpm format:check` - passed.
- `pnpm lint` - passed.
- `pnpm build` - passed.
- `pnpm test` - passed: 16 test files, 146 tests.
- `aisdlc verify --root . --swarm issue-38-delivery --work issue-38 --run --json` - passed for `pnpm build` and `pnpm test`.

## Acceptance coverage

- Extension builds/packages: `extensions/vscode` is a workspace package and builds through `pnpm build`.
- Opens same project semantics as Web: `parseStoredProject` and `openStoredProject` validate stored canonical project data.
- Active node maps correctly to editor range: `rangeForNode` is covered by Studio tests.
- Step updates code + World Preview + inspector consistently: runtime observations feed preview frames and inspector rows from the same result.
- ProgramProposal can be inspected/rejected/applied explicitly: proposal review tests cover proposed projection, reject and apply.
- No silent mutation: rejection returns the accepted program unchanged; apply is explicit.
- Web-created fixture opens in Studio: stored Web-like fixture is parsed and projected in Studio tests.
- Studio-modified canonical fixture reopens in Web via #121: Studio produces a stored modified fixture suitable for #121 round-trip validation.
- Visual language follows #117: `docs/product/AGORIX_STUDIO.md` traces Studio surface direction to the design system and #119 Worlds boundary.
