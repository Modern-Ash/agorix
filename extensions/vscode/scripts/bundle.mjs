// Bundles the extension and every workspace package it uses into one CommonJS file.
// Workspace packages ship TypeScript sources and the extension host cannot resolve
// pnpm workspace links inside a VSIX, so the VSIX must carry a self-contained bundle.
import { build } from "esbuild";

await build({
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["vscode"],
  sourcemap: true,
  logLevel: "info",
});
