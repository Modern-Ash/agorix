# Verification evidence - issue #121

Tested commit: `6e9d3c35efb1b4ac595092c75fefc35ccf67e7c5`

## Commands

- `pnpm format:check` - passed
- `pnpm lint` - passed
- `pnpm build` - passed
- `pnpm test` - passed, 17 files / 152 tests
- `aisdlc verify --root . --swarm issue-121-delivery --work issue-121 --run --json` - passed for build and test

## Acceptance mapping

- Web-created project opens in Studio: `extensions/vscode/src/crossSurfaceCompatibility.test.ts`
- Studio-created/modified canonical project opens in Web: `extensions/vscode/src/crossSurfaceCompatibility.test.ts`
- Semantic hash/equivalence preserved through round trip: `semanticProjectHash` and `assertSemanticallyEquivalentProjects`
- Unsupported newer schema fails explicitly: `ProjectStore` future-schema test expects `UNKNOWN_VERSION`
- Presentation state does not contaminate program state: semantic hash excludes presentation/localization preferences
- Locale switch remains independent: locale change keeps semantic hash stable
- No UI-specific identifiers leak into canonical model: `assertNoUiSpecificProgramState`

## Note

The local environment uses Node `v20.19.0`; the repository declares Node `>=22 <23`, so pnpm prints an engine warning. The commands still completed successfully.
