import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { webSecurityHeaders } from "./src/securityHeaders.js";
import { readFileSync } from "node:fs";
import { devBackendPlugin } from "./src/dev/devBackendPlugin.js";

// Issue #30: the dev and preview servers emit the same web security headers a
// static host must. Source of truth: src/securityHeaders.ts.
const developmentHeaders = webSecurityHeaders("development");
const productionHeaders = webSecurityHeaders("production");

const packageVersion = (
  JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
    version: string;
  }
).version;

export default defineConfig({
  // Build identity (issue #342): version from package.json, commit from the GIT_SHA build arg.
  define: {
    __AGORIX_VERSION__: JSON.stringify(packageVersion),
    __AGORIX_SHA__: JSON.stringify(process.env["GIT_SHA"] ?? "dev"),
  },
  plugins: [react(), devBackendPlugin(process.env["AGORIX_DEV_BACKEND"] === "1")],
  server: { headers: developmentHeaders },
  preview: { headers: productionHeaders },
});
