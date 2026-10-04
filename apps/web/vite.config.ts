import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { webSecurityHeaders } from "./src/securityHeaders.js";
import { devBackendPlugin } from "./src/dev/devBackendPlugin.js";

// Issue #30: the dev and preview servers emit the same web security headers a
// static host must. Source of truth: src/securityHeaders.ts.
const developmentHeaders = webSecurityHeaders("development");
const productionHeaders = webSecurityHeaders("production");

export default defineConfig({
  plugins: [react(), devBackendPlugin(process.env["AGORIX_DEV_BACKEND"] === "1")],
  server: { headers: developmentHeaders },
  preview: { headers: productionHeaders },
});
