// Self-contained server bundle (issue #348). Workspace packages ship TypeScript sources, so the
// runtime image cannot resolve them from plain `node`; bundle everything into one ESM file.
import { build } from "esbuild";

await build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/main.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  banner: {
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
  sourcemap: true,
  logLevel: "info",
});
