import { build } from "esbuild";

await build({
  entryPoints: ["src/main.ts", "src/backup.ts", "src/migrate.ts"],
  outdir: "dist",
  outExtension: { ".js": ".mjs" },
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
