# Agorix Studio VS Code extension

Agorix Studio is the progressive VS Code surface for Agorix projects. It reuses shared `packages/*` contracts instead of creating a second programming model.

The first slice keeps VS Code API imports isolated in `src/extension.ts`; project semantics, projection mapping, execution evidence and proposal review are implemented in pure modules with deterministic tests.

See `docs/product/AGORIX_STUDIO.md` for the product architecture.
