import { defineConfig, devices } from "@playwright/test";

/**
 * Viewport matrix required by issue #91 (AC-008/AC-009): tablet portrait and
 * landscape at the product's minimum/typical/large tablet sizes, plus a
 * conventional desktop baseline.
 */
export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "pnpm preview --port 4173",
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: "http://localhost:4173",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "tablet-portrait-768x1024", use: { viewport: { width: 768, height: 1024 } } },
    { name: "tablet-landscape-1024x768", use: { viewport: { width: 1024, height: 768 } } },
    { name: "tablet-portrait-820x1180", use: { viewport: { width: 820, height: 1180 } } },
    { name: "tablet-landscape-1180x820", use: { viewport: { width: 1180, height: 820 } } },
    { name: "tablet-landscape-1366x1024", use: { viewport: { width: 1366, height: 1024 } } },
  ],
});
