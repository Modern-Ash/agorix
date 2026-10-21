import { defineConfig } from "@playwright/test";

// Read-only smoke against the deployed site (issue #345):
//   AGORIX_E2E_BASE_URL=https://agorix.modern-ash.com pnpm --filter @agorix/web test:prod
// Optional AGORIX_EXPECT_SHA makes the run assert /version.json reports that commit.
const baseURL = process.env["AGORIX_E2E_BASE_URL"];
if (baseURL === undefined || baseURL === "") {
  throw new Error("AGORIX_E2E_BASE_URL is required (for example https://agorix.modern-ash.com)");
}

export default defineConfig({
  testDir: "./e2e/prod",
  retries: 1,
  timeout: 45_000,
  reporter: [["list"]],
  use: { baseURL },
});
