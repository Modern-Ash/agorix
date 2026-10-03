# Agorix Studio VS Code extension

Agorix Studio is the progressive VS Code surface for Agorix projects. It reuses shared `packages/*` contracts instead of creating a second programming model.

The first slice keeps VS Code API imports isolated in `src/extension.ts`; project semantics, projection mapping, execution evidence and proposal review are implemented in pure modules with deterministic tests.

See `docs/product/AGORIX_STUDIO.md` for the product architecture.

## Commands

| Command                                          | What it does                                                                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `Agorix Studio: Open Project`                    | Opens a portable `.agorix` file or legacy stored-project JSON and shows its code projection in an editor.                      |
| `Agorix Studio: Export Portable .agorix Project` | Writes a portable `.agorix` envelope without account, revision, token, undo/redo, or history state.                            |
| `Agorix Studio: Open Account Project`            | Opens an authenticated server project when `agorixStudio.serverUrl` is configured and a token is stored in SecretStorage.      |
| `Agorix Studio: Save Account Project`            | Saves with the expected server revision and offers reload/export/cancel on conflict; it never silently overwrites newer data.  |
| `Agorix Studio: Show Execution Evidence`         | Runs the shared runtime and prints the Execution Inspector (step, node, before/after world) to an Output channel.              |
| `Agorix Studio: Validate Project`                | Runs shared canonical validation/runtime checks and writes a JSON report to the Output channel.                                |
| `Agorix Studio: Run Agorix Checks`               | Starts a native VS Code task for `pnpm verify` instead of embedding a second test runner.                                      |
| `Agorix Studio: Open Source Control`             | Opens the built-in VS Code SCM view; Studio does not implement a parallel Git client.                                          |
| `Agorix Studio: Suggest repeat`                  | Same deterministic suggestion as Web: shows a diff of the projection, then Apply or Reject. The file is only written on Apply. |

The commands are thin: all semantics live in `src/studioCore.ts`. `src/extension.test.ts` drives the commands against a simulated `vscode` module (open, evidence, diff, Apply/Reject, file write-back, error paths).

Every command failure (invalid project, runtime error, write failure) is shown as an error message and logged with its stack to the `Agorix Studio` Output channel. Activation failures are surfaced the same way and re-thrown, so VS Code also lists them under Developer: Show Running Extensions.

For automation, `Open Project` accepts a `Uri` argument (skips the file picker), `Show Execution Evidence` returns the report string, and `Validate Project` / `Show Developer Context` return JSON strings.

Account integration is optional. Tokens are saved only through VS Code `SecretStorage`; server URL is the only account-related setting. Remote project id/revision is kept in Studio session state and excluded from canonical program semantics and portable `.agorix` files.

## Supported VS Code versions

`engines.vscode` is `^1.95.0`. The Extension Host integration suite runs in CI against 1.95.0 (the minimum) and the latest stable release, and was run locally against 1.95.0, 1.105.0 and 1.140.0. `activationEvents` is empty on purpose: since VS Code 1.74 contributed commands activate the extension automatically, and the engine floor is above that.

## Install

From a VSIX (not published to the Marketplace yet):

```sh
pnpm install
pnpm --filter agorix-studio package          # builds dist/agorix-studio.vsix
code --install-extension extensions/vscode/dist/agorix-studio.vsix
```

Then run `Agorix Studio: Open Project` and pick a stored project JSON or `.agorix` file, for example `extensions/vscode/test/integration/fixtures/repeat.agorix.json`.

## Develop

1. `pnpm install`, then open the repository root in VS Code.
2. Press F5 and pick `Agorix Studio: Extension Development Host` (`.vscode/launch.json`). It builds first and opens the fixtures folder.
3. `pnpm --filter agorix-studio build` bundles `src/extension.ts` and the workspace packages into one CommonJS file, `dist/extension.cjs`, with esbuild. The bundle is required because workspace packages ship TypeScript sources and a VSIX cannot carry pnpm workspace links.

### Tests

| Command                                        | What it covers                                                                                                                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter agorix-studio test`             | Unit tests: `studioCore`, cross-surface compatibility and command wiring against a simulated `vscode` module.                                                    |
| `pnpm --filter agorix-studio test:integration` | Real Extension Host (downloads VS Code via `@vscode/test-electron`): activation, commands, Open Project, projection editor, evidence, validation, proposal diff. |
| `pnpm --filter agorix-studio test:vsix`        | Installs the packaged VSIX into a clean `--user-data-dir`/`--extensions-dir` and runs the same suite against it.                                                 |

Set `VSCODE_VERSION` (for example `1.95.0`) to pick the VS Code build. On a headless Linux machine wrap the commands in `xvfb-run -a`. If you launch from inside a VS Code terminal, `ELECTRON_RUN_AS_NODE` is cleared by the harness. The `Agorix Studio: Integration Tests` launch config runs the suite from F5.

The integration suite deliberately does not click the Apply/Reject prompt (it cannot be driven through the API); Apply and Reject write-back is covered by the unit tests.

### Boundary

Only `extensions/vscode` may import `vscode`. `scripts/vscode-boundary.test.mjs` fails if any `packages/*` source or manifest references it, and ESLint forbids it in domain packages.
