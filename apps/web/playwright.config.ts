import { defineConfig } from "@playwright/test";

const port = Number(process.env.AGORIX_E2E_PORT ?? 4173);
const host = process.env.AGORIX_E2E_HOST ?? "127.0.0.1";

export default defineConfig({
  testDir: "./e2e",
  // e2e/prod runs against the deployed site with its own config (issue #345).
  testIgnore: "prod/**",
  // Keep the snapshot names from before the projects existed (no project name in the file name).
  snapshotPathTemplate:
    "{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-snapshotSuffix}{ext}",
  // A rare timing flake in CI should not block a PR; a real failure fails twice and still shows red.
  retries: process.env["CI"] ? 1 : 0,
  // Chromium runs everything. WebKit (Safari, iPad) is opt-in with AGORIX_E2E_WEBKIT=1 and runs the
  // child's journeys below (issue #1220). Left out on purpose: kids-quality-matrix, whose offline
  // leg depends on the service worker that the e2e suite blocks, so a lazy stylesheet fails to load
  // in Safari; the rest of the suite is Chromium-only until measured.
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        // A flake that passes on its retry leaves nothing behind, so CI keeps the trace of every
        // failed attempt (issue #1230: a Step button "not stable" that never reproduced locally).
        // Chromium only: with tracing on, WebKit failed to import lazy module scripts in CI.
        trace: process.env["CI"] ? "retain-on-failure" : "off",
      },
    },
    ...(process.env["AGORIX_E2E_WEBKIT"] === "1"
      ? [
          {
            name: "webkit",
            use: { browserName: "webkit" as const },
            testMatch:
              /kids-(child-journey|audio|golden|mission-studio|create-selection|routes|map|shell|gallery|delete-project|free-access|studio-tools)\.spec\.ts/,
          },
        ]
      : []),
  ],
  webServer: {
    // AGORIX_DEV_BACKEND mounts the in-process DEV/E2E-only account backend (never part of the build).
    command: `AGORIX_DEV_BACKEND=1 corepack pnpm preview --host ${host} --port ${port}`,
    port,
    host,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: `http://${host}:${port}`,
    // The product opens in Spanish (issue #351); the existing journeys assert English copy.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: `http://${host}:${port}`,
          localStorage: [{ name: "agorix.locale", value: "en" }],
        },
      ],
    },
  },
});
