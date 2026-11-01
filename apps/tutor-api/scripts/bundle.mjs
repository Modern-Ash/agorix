// Self-contained server bundle (issue #348). Workspace packages ship TypeScript sources, so the
// runtime image cannot resolve them from plain `node`; bundle everything into one ESM file.
import { build } from "esbuild";
import process from "node:process";

const buildSha = process.env.AGORIX_TUTOR_BUILD_SHA ?? null;
if (buildSha !== null && !/^[0-9a-f]{12}$/.test(buildSha)) {
  throw new Error("AGORIX_TUTOR_BUILD_SHA must be a 12-digit lowercase Git SHA");
}

await build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/main.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  define: { __AGORIX_TUTOR_BUILD_SHA__: JSON.stringify(buildSha) },
  banner: {
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
  sourcemap: true,
  logLevel: "info",
});
