import { build } from "esbuild";

await build({
  entryPoints: ["src/main.ts", "src/backup.ts"],
  outdir: "dist",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  logLevel: "info",
});
