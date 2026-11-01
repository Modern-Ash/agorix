import { test, expect } from "./fixtures.js";
import { spawn, type ChildProcess } from "node:child_process"; // agora-allowlist: test-only spawn of the local Ori reference process, fixed arguments
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";

const oriRoot = process.env.ORI_REPO_PATH;
const root = resolve(new URL(".", import.meta.url).pathname, "../../..");
const tutorBinary = join(root, "apps/tutor-api/dist/main.mjs");
const runnable =
  process.env.VITE_ORI_EXPERIMENTAL_REVIEW === "1" &&
  !!oriRoot &&
  existsSync(join(oriRoot, "examples/local-agent-runtime.mjs")) &&
  existsSync(tutorBinary);

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  const port = address.port;
  await new Promise<void>((done) => server.close(() => done()));
  return port;
}
test.describe("real browser → Tutor API → Ori process", () => {
  test.skip(!runnable, "Requires explicit experimental build, Ori checkout and built Tutor API");
  test("shows an actual deterministic Ori hint without applying changes", async ({ page }) => {
    const port = await freePort();
    const backend = `http://127.0.0.1:${port}`;
    const workspace = mkdtempSync(join(tmpdir(), "agorix-ori-browser-"));
    const child: ChildProcess = spawn(process.execPath, [tutorBinary], {
      cwd: root,
      stdio: "ignore",
      env: {
        ...process.env,
        AGORIX_TUTOR_HOST: "127.0.0.1",
        AGORIX_TUTOR_PORT: String(port),
        AGORIX_TUTOR_ADAPTER: "fake",
        AGORIX_ORI_RUNTIME_PREVIEW: "1",
        ORI_REPO_PATH: oriRoot!,
        AGORIX_AI_CONFIG_DB_PATH: join(workspace, "config.sqlite"),
      },
    });
    try {
      let healthy = false;
      for (let i = 0; i < 60; i++) {
        if (child.exitCode !== null) throw new Error("Tutor API terminated");
        try {
          const response = await fetch(backend + "/api/tutor/health");
          if (response.ok) {
            healthy = true;
            break;
          }
        } catch {
          /* wait for server */
        }
        await new Promise((done) => setTimeout(done, 100));
      }
      expect(healthy).toBe(true);
      let forwarded = 0;
      await page.route("**/api/tutor/ori/runtime-preview", async (route) => {
        forwarded++;
        const response = await route.fetch({
          url: backend + "/api/tutor/ori/runtime-preview",
          headers: { "content-type": "application/json", origin: backend },
        });
        await route.fulfill({ response });
      });
      await page.goto("/");
      const panel = page.getByTestId("ori-review-panel");
      await expect(panel).toBeVisible();
      await panel.getByRole("button", { name: "Necesito ayuda" }).click();
      await expect(panel.getByText("Solo para revisión. No se aplicaron cambios.")).toBeVisible();
      await expect(panel.getByText(/Siguiente paso:/)).toBeVisible();
      expect(forwarded).toBe(1);
    } finally {
      if (child.exitCode === null) child.kill("SIGTERM");
      await new Promise<void>((done) => {
        if (child.exitCode !== null) return done();
        child.once("exit", () => done());
        setTimeout(done, 2000);
      });
      if (child.exitCode === null) child.kill("SIGKILL");
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
