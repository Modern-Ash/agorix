# Agorix Studio VS Code extension

Agorix Studio is the progressive VS Code surface for Agorix projects. It reuses shared `packages/*` contracts instead of creating a second programming model.

The first slice keeps VS Code API imports isolated in `src/extension.ts`; project semantics, projection mapping, execution evidence and proposal review are implemented in pure modules with deterministic tests.

See `docs/product/AGORIX_STUDIO.md` for the product architecture.

## Commands

| Command                                  | What it does                                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `Agorix Studio: Open Project`            | Opens a stored Agorix project (`StoredProject` JSON) and shows its code projection in an editor.                               |
| `Agorix Studio: Show Execution Evidence` | Runs the shared runtime and prints the Execution Inspector (step, node, before/after world) to an Output channel.              |
| `Agorix Studio: Suggest repeat`          | Same deterministic suggestion as Web: shows a diff of the projection, then Apply or Reject. The file is only written on Apply. |

The commands are thin: all semantics live in `src/studioCore.ts`. `src/extension.test.ts` drives the commands against a simulated `vscode` module (open, evidence, diff, Apply/Reject, file write-back, error paths). It has not been run inside a real VS Code window; do that with F5 in the extension host before publishing.
