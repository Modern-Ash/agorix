import { defineConfig } from "@playwright/test";

const port = Number(process.env.AGORIX_E2E_PORT ?? 4173);

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    // AGORIX_DEV_BACKEND mounts the in-process DEV/E2E-only account backend (never part of the build).
    command: `AGORIX_DEV_BACKEND=1 pnpm preview --port ${port}`,
    port,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: `http://localhost:${port}`,
  },
});
