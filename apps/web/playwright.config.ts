import { defineConfig } from "@playwright/test";

const port = Number(process.env.AGORIX_E2E_PORT ?? 4173);
const host = process.env.AGORIX_E2E_HOST ?? "127.0.0.1";

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    // AGORIX_DEV_BACKEND mounts the in-process DEV/E2E-only account backend (never part of the build).
    command: `AGORIX_DEV_BACKEND=1 corepack pnpm preview --host ${host} --port ${port}`,
    port,
    host,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: `http://${host}:${port}`,
  },
});
