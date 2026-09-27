# Level 1 Plan

## Goal

Deliver a reviewable first slice of Agorix Studio that proves the VS Code surface can share project,
program, projection, runtime and proposal boundaries with Web.

## Steps

1. Establish `extensions/vscode` as a workspace package that builds under pnpm.
2. Define Studio architecture docs covering Activity Bar/Side Bar, editor projection, World Preview,
   Execution Inspector and ProgramProposal review.
3. Implement extension package scaffold with VS Code activation boundaries and no domain imports from
   VS Code-specific code except adapters.
4. Add shared project fixture loading for canonical project semantics.
5. Add textual projection and node-to-range mapping using existing projection contracts.
6. Add execution stepping/evidence model using existing runtime/stage contracts.
7. Add ProgramProposal review model with inspect/reject/apply paths and no silent mutation.
8. Add deterministic tests for extension-local pure modules and shared fixtures.
9. Run build/test/format and package-oriented verification where available.

## Out of scope for first slice

- Full marketplace packaging/release.
- Complete AI provider integration.
- Full Git/issues/SDLC workflow.
- Final Web/Studio round-trip proof; that remains #121, using fixtures created here.
