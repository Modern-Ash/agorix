// Runs a visible learner journey against an installed VSIX in an isolated VS Code profile.
// VSCODE_EXECUTABLE=/usr/share/code/code node test/integration/visual-journey.cjs
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");
const assert = require("node:assert/strict");
const { chromium } = require("../../../../apps/web/node_modules/@playwright/test");

const vscode = process.env.VSCODE_EXECUTABLE || "/usr/share/code/code";
const cli = path.join(path.dirname(vscode), "bin", "code");
const vsix = path.resolve(__dirname, "../../dist/agorix-studio.vsix");
const fixture = path.resolve(__dirname, "fixtures/visual-workspace.agorix");
const repoRoot = path.resolve(__dirname, "../../../..");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "agorix-studio-visual-"));
const project = path.join(scratch, "visual.agorix");
const profile = [
  "--user-data-dir",
  path.join(scratch, "profile"),
  "--extensions-dir",
  path.join(scratch, "extensions"),
];
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const port = 9300 + Math.floor(Math.random() * 300);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  if (!fs.existsSync(vsix)) throw new Error("Package the VSIX first");
  fs.copyFileSync(fixture, project);
  const install = cp.spawnSync(cli, [...profile, "--install-extension", vsix], {
    env,
    encoding: "utf8",
  });
  if (install.status !== 0) throw new Error(`VSIX install failed: ${install.stderr}`);
  const child = cp.spawn(
    vscode,
    [
      `--remote-debugging-port=${port}`,
      "--window-size=900,700",
      ...profile,
      "--disable-workspace-trust",
      "--new-window",
      project,
    ],
    { env, detached: true, stdio: "ignore" },
  );
  let browser;
  let webBrowser;
  let webChild;
  try {
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        const response = await globalThis.fetch(`http://127.0.0.1:${port}/json/version`);
        if (response.ok) break;
      } catch {
        /* VS Code is starting */
      }
      if (attempt === 59) throw new Error("VS Code CDP did not start");
      await pause(500);
    }
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const context = browser.contexts()[0];
    const page = context.pages().find((item) => item.url().startsWith("vscode-file:"));
    if (!page) throw new Error("VS Code window not found");
    const onboarding = page.getByRole("dialog", { name: "Welcome to Visual Studio Code" });
    await onboarding.waitFor({ timeout: 10000 });
    await onboarding.getByText("Continue without Signing In").click();
    await onboarding.getByText("Get Started", { exact: true }).click();
    await onboarding.waitFor({ state: "hidden" });
    await page.waitForTimeout(1000);
    await page.keyboard.press("Control+Shift+P");
    await page.locator(".quick-input-widget input").first().fill(">Reopen Editor With");
    await page.getByText("View: Reopen Editor With...", { exact: true }).click();
    await page.locator(".quick-input-widget input").first().fill("Agorix Workbench");
    await page.keyboard.press("Enter");
    await page.locator(".tab").filter({ hasText: "visual.agorix" }).first().click();
    const webview = page.frameLocator("iframe.webview.ready").frameLocator("iframe#active-frame");
    const workbench = webview.locator(".workbench");
    await workbench.waitFor({ timeout: 10000 });
    await webview.locator(".studio-program .block").first().waitFor();
    console.log("Loaded canonical program, stage and Ori");
    await webview.locator(".studio-editor-tabs button").filter({ hasText: "Scene" }).click();
    await webview
      .locator(".studio-scene-editor .scene-actors button")
      .filter({ hasText: "Helper" })
      .click();
    await webview
      .locator(".studio-scene-editor .scene-section-tabs button")
      .filter({ hasText: "Costumes" })
      .click();
    await webview.locator(".studio-scene-editor .scene-create-shortcut:visible").click();
    await webview.getByLabel("Image name").fill("My painted star");
    const drawing = webview.locator(".studio-scene-editor canvas[aria-label='Draw image']");
    const bounds = await drawing.boundingBox();
    if (!bounds) throw new Error("Drawing canvas not visible");
    await page.mouse.move(bounds.x + 20, bounds.y + 20);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 80, bounds.y + 60, { steps: 5 });
    await page.mouse.up();
    await webview.getByRole("button", { name: "Save drawing" }).click();
    await page.getByText("I am an adult and approve").click();
    await page.keyboard.press("Escape");
    await webview
      .getByRole("button", { name: "Choose costume: My painted star" })
      .waitFor({ timeout: 5000 });
    await webview
      .getByRole("button", { name: "Choose costume: My painted star" })
      .click({ timeout: 5000 });
    console.log("Created and selected a painted costume");
    await webview.locator(".studio-editor-tabs button").filter({ hasText: "Build" }).click();
    const move = webview
      .locator(".palette button[draggable='true']")
      .filter({ hasText: "Move" })
      .first();
    const slot = webview.locator(".studio-program .slot").first();
    const before = await webview.locator(".studio-program .block").count();
    await move.dragTo(slot);
    await page.waitForTimeout(500);
    const after = await webview.locator(".studio-program .block").count();
    if (after <= before) throw new Error(`Block drag did not insert: ${before} → ${after}`);
    console.log("Dragged a block into the canonical program");
    await webview.locator(".execution-toolbar button").filter({ hasText: "Play" }).click();
    await webview
      .locator(".execution-readout")
      .filter({ hasText: "completed" })
      .waitFor({ timeout: 10000 });
    await webview.locator(".studio-editor-tabs button").filter({ hasText: "Evidence" }).click();
    await webview.locator(".studio-evidence").waitFor();
    const traceCount = (await webview.locator(".event-trace header span").textContent())?.split(
      "/",
    )[1];
    if (!traceCount || Number(traceCount) < 1) throw new Error("Run produced no event trace");
    console.log("Ran project and opened evidence");
    const saved = JSON.parse(fs.readFileSync(project, "utf8"));
    if (!saved.project?.metadata?.assets?.some((asset) => asset.name === "My painted star")) {
      throw new Error("Painted costume was not persisted");
    }
    const initial = JSON.parse(fs.readFileSync(fixture, "utf8"));
    const statementCount = (program) =>
      program.scripts.reduce((total, script) => total + script.statements.length, 0);
    if (statementCount(saved.project.program) <= statementCount(initial.project.program)) {
      throw new Error("Dragged block was not persisted");
    }
    const webPort = 4400 + Math.floor(Math.random() * 300);
    webChild = cp.spawn(
      "pnpm",
      ["--filter", "@agorix/web", "dev", "--host", "127.0.0.1", "--port", String(webPort)],
      { cwd: repoRoot, env, detached: true, stdio: "ignore" },
    );
    const webUrl = `http://127.0.0.1:${webPort}`;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        const response = await globalThis.fetch(webUrl);
        if (response.ok) break;
      } catch {
        /* Web is starting */
      }
      if (attempt === 59) throw new Error("Web dev server did not start");
      await pause(500);
    }
    webBrowser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    const webContext = await webBrowser.newContext();
    await webContext.addInitScript(() => globalThis.localStorage.setItem("agorix.locale", "en"));
    const webPage = await webContext.newPage();
    await webPage.goto(`${webUrl}/advanced`);
    await webPage.locator(".editor-shell").first().waitFor();
    await webPage.getByLabel("Import Agorix project file").setInputFiles(project);
    await webPage.getByText("Project imported. Blocks and code loaded from the file.").waitFor();
    const reopened = await webPage.evaluate(() =>
      JSON.parse(globalThis.localStorage.getItem("agorix:default-project") || "null"),
    );
    if (!reopened) throw new Error("Web did not persist the imported project");
    assert.deepEqual(reopened.program, saved.project.program);
    assert.deepEqual(reopened.metadata.actors, saved.project.metadata.actors);
    const expectedAssets = saved.project.metadata.assets.map((asset) => ({
      ...asset,
      source: asset.source.startsWith("embedded:") ? saved.media[asset.id] : asset.source,
    }));
    assert.deepEqual(reopened.metadata.assets, expectedAssets);
    const painted = expectedAssets.find((asset) => asset.name === "My painted star");
    if (!painted) throw new Error("Painted costume missing after Web import");
    assert.equal(await webPage.getByTestId("stage-sprite").count(), 2);
    await webPage
      .locator(`[data-testid="stage-sprite"][data-costume-id="${painted.id}"]`)
      .first()
      .waitFor({ timeout: 5000 });
    await webPage.locator(".stage-panel").getByRole("button", { name: "Run", exact: true }).click();
    await webPage.locator('[data-fact-source="runtime"]').first().waitFor({ timeout: 10000 });
    const openMenu = async () => {
      const menu = webPage.getByRole("button", { name: "Show app menu" });
      if (await menu.isVisible()) await menu.click();
    };
    const exportButton = () =>
      webPage.locator("#app-menu").getByRole("button", { name: "Export", exact: true });
    let downloadCount = 0;
    webPage.on("download", () => {
      downloadCount += 1;
    });
    await openMenu();
    webPage.once("dialog", async (dialog) => {
      assert.match(dialog.message(), /adult/i);
      await dialog.dismiss();
    });
    await exportButton().click();
    await webPage.waitForTimeout(250);
    assert.equal(downloadCount, 0, "Declined adult approval must not export media");
    await openMenu();
    webPage.once("dialog", async (dialog) => {
      assert.match(dialog.message(), /adult/i);
      await dialog.accept();
    });
    const downloadPromise = webPage.waitForEvent("download");
    await exportButton().click();
    const download = await downloadPromise;
    const exported = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
    assert.deepEqual(exported.project.program, reopened.program);
    assert.equal(exported.media?.[painted.id], painted.source);
    console.log("Reopened the same program, actors and costume in Web; runtime evidence visible");
    console.log("Visual cross-surface journey passed");
  } finally {
    await webBrowser?.close();
    if (webChild !== undefined) {
      try {
        process.kill(-webChild.pid, "SIGTERM");
      } catch {
        /* already exited */
      }
    }
    await browser?.close();
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      /* already exited */
    }
    await pause(800);
  }
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => fs.rmSync(scratch, { recursive: true, force: true }));
