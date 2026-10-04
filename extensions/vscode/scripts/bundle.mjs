// Bundles the extension and every workspace package it uses into one CommonJS file.
// Workspace packages ship TypeScript sources and the extension host cannot resolve
// pnpm workspace links inside a VSIX, so the VSIX must carry a self-contained bundle.
import { URL } from "node:url";
import { build } from "esbuild";

const workspaceAlias = {
  name: "workspace-alias",
  setup(build) {
    build.onResolve({ filter: /^@agorix\/agent-workflow$/ }, () => ({
      path: new URL("../../../packages/agent-workflow/src/index.ts", import.meta.url).pathname,
    }));
  },
};

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

// Webview bundle for the Workbench (browser IIFE, loaded through a nonce-protected script tag).
await build({
  entryPoints: ["webview/main.tsx"],
  outfile: "dist/workbench.js",
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [workspaceAlias],
  logLevel: "info",
});
