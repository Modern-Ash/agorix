// Self-contained server bundle (issue #348). Workspace packages ship TypeScript sources, so the
// runtime image cannot resolve them from plain `node`; bundle everything into one ESM file.
import { build } from "esbuild";

// Keep the legacy command unchanged while packaging an explicit, guarded
// PostgreSQL production entrypoint for operators.
for (const name of ["main", "main-mig04"]) {
  await build({
    entryPoints: [`src/${name}.ts`],
    outfile: `dist/${name}.mjs`,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    sourcemap: true,
    logLevel: "info",
  });
}
