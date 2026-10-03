import { defineConfig } from "@playwright/test";

const port = Number(process.env.AGORIX_E2E_PORT ?? 4173);

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: `pnpm preview --port ${port}`,
    port,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: `http://localhost:${port}`,
  },
});
