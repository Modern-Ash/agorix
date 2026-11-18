// Runs a visible learner journey against an installed VSIX in an isolated VS Code profile.
// VSCODE_EXECUTABLE=/usr/share/code/code node test/integration/visual-journey.cjs
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");
const http = require("node:http");
const assert = require("node:assert/strict");
const { chromium } = require("../../../../apps/web/node_modules/@playwright/test");
const {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
} = require("@vscode/test-electron");

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
const { buildSync } = require("esbuild");
async function waitForProject(predicate) {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const raw = fs.readFileSync(project, "utf8");
      const value = JSON.parse(raw);
      if (predicate(value)) return { raw, value };
    } catch {
      /* VS Code may be writing the project */
    }
    await pause(100);
  }
  throw new Error("The saved project did not reach the expected state");
}

async function main() {
  if (!fs.existsSync(vsix)) throw new Error("Package the VSIX first");
  const vscode =
    process.env.VSCODE_EXECUTABLE ||
    (await downloadAndUnzipVSCode(process.env.VSCODE_VERSION || "stable"));
  const [cli, ...cliArgs] = resolveCliArgsFromVSCodeExecutablePath(vscode);
  fs.copyFileSync(fixture, project);
  const boundaryBundle = path.join(scratch, "ori-boundary.cjs");
  buildSync({
    entryPoints: [path.join(repoRoot, "apps/tutor-api/src/oriStudioCompanion.ts")],
    outfile: boundaryBundle,
    bundle: true,
    platform: "node",
    format: "cjs",
  });
  const { runOriStudioCompanion } = require(boundaryBundle);
  const boundaryCalls = [];
  const boundary = http.createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.method === "GET" && request.url === "/health") {
      response.end(JSON.stringify({ status: "available" }));
      return;
    }
    if (request.method !== "POST" || request.url !== "/companion") {
      response.writeHead(404).end("{}");
      return;
    }
    try {
      let body = "";
      for await (const chunk of request) body += chunk;
      const asked = JSON.parse(body);
      boundaryCalls.push(asked.capability);
      const answer = await runOriStudioCompanion(asked, {
        generate: async () =>
          asked.capability === "builder"
            ? '{"type":"turn","degrees":90}'
            : '{"message":"What changed after the last run?"}',
      });
      response.end(JSON.stringify(answer));
    } catch {
      response.writeHead(400).end("{}");
    }
  });
  await new Promise((resolve) => boundary.listen(0, "127.0.0.1", resolve));
  const boundaryPort = boundary.address().port;
  const userDir = path.join(scratch, "profile", "User");
  fs.mkdirSync(userDir, { recursive: true });
  fs.writeFileSync(
    path.join(userDir, "settings.json"),
    JSON.stringify({ "agorixStudio.agent.endpoint": `http://127.0.0.1:${boundaryPort}` }),
  );
  const install = cp.spawnSync(cli, [...cliArgs, ...profile, "--install-extension", vsix], {
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
    let page;
    for (let attempt = 0; attempt < 30; attempt++) {
      page = context.pages().find((item) => item.url().startsWith("vscode-file:"));
      if (page !== undefined) break;
      await pause(200);
    }
    if (!page) throw new Error("VS Code window not found");
    await page.locator(".monaco-workbench").waitFor({ timeout: 30000 });
    await page.bringToFront();
    await page.setViewportSize({ width: 900, height: 700 });
    const onboarding = page.getByRole("dialog", { name: "Welcome to Visual Studio Code" });
    await onboarding.waitFor({ timeout: 10000 }).catch(() => undefined);
    if (await onboarding.isVisible()) {
      await onboarding.getByText("Continue without Signing In").click();
      await onboarding.getByText("Get Started", { exact: true }).click();
      await onboarding.waitFor({ state: "hidden" });
    }
    await page.waitForTimeout(1000);
    await page.keyboard.press("F1");
    await page.locator(".quick-input-widget input").first().fill(">Reopen Editor With");
    await page.getByText("View: Reopen Editor With...", { exact: true }).click();
    await page.locator(".quick-input-widget input").first().fill("Agorix Workbench");
    await page.keyboard.press("Enter");
    await page.locator(".tab").filter({ hasText: "visual.agorix" }).first().click();
    const webview = page.frameLocator("iframe.webview.ready").frameLocator("iframe#active-frame");
    const workbench = webview.locator(".workbench");
    await workbench.waitFor({ timeout: 10000 });
    await webview.locator(".studio-program .block").first().waitFor();
    await webview.locator('.stage-list-watcher[data-list-id="inventory"]').waitFor();
    assert.match(
      await webview.locator('.stage-list-watcher[data-list-id="inventory"]').innerText(),
      /Inventory/,
    );
    const beforeOriReview = fs.readFileSync(project, "utf8");
    await page.keyboard.press("F1");
    await page.locator(".quick-input-widget input").first().fill(">Suggest repeat");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Reject", exact: true }).click();
    assert.equal(fs.readFileSync(project, "utf8"), beforeOriReview);
    await page.locator(".tab").filter({ hasText: "visual.agorix" }).first().click();
    console.log("Rejected a reviewed Studio proposal without changing the project");
    const programBounds = await webview.locator(".studio-program").boundingBox();
    const stageBounds = await webview.locator(".studio-play").boundingBox();
    const oriBounds = await webview.locator(".studio-ori-dock").boundingBox();
    if (
      !programBounds ||
      !stageBounds ||
      !oriBounds ||
      programBounds.y > 260 ||
      stageBounds.y > 260 ||
      stageBounds.x <= programBounds.x ||
      oriBounds.x <= stageBounds.x
    ) {
      throw new Error("Build must show program, stage and Ori side by side in the first viewport");
    }
    assert.equal(await webview.locator(".studio-tools").isVisible(), false);
    const componentLauncher = webview.locator(".studio-component-launcher");
    assert.equal(await componentLauncher.isVisible(), true);
    await componentLauncher.getByRole("button", { name: "Motion" }).click();
    assert.equal(await webview.locator(".studio-tools").isVisible(), true);
    assert.equal(await webview.locator(".studio-tools .palette-section").count(), 1);
    await webview.locator(".studio-program-heading button").click();
    assert.equal(await webview.locator(".studio-tools").isVisible(), false);
    const resize = webview.locator(".studio-ori-resize");
    const resizeBounds = await resize.boundingBox();
    if (!resizeBounds) throw new Error("Ori resize handle is not visible");
    const initialOriWidth = (await webview.locator(".studio-ori-dock").boundingBox()).width;
    await page.mouse.move(resizeBounds.x + 4, resizeBounds.y + 50);
    await page.mouse.down();
    await page.mouse.move(resizeBounds.x - 16, resizeBounds.y + 50, { steps: 5 });
    await page.mouse.up();
    const expandedOriWidth = (await webview.locator(".studio-ori-dock").boundingBox()).width;
    if (expandedOriWidth < initialOriWidth + 10) throw new Error("Dragging must widen Ori");
    const firstBlockLabelFits = await webview
      .locator(".studio-program .block .label")
      .first()
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
    if (!firstBlockLabelFits)
      throw new Error("Resizing Ori must keep the first block label legible");
    if (process.env.AGORIX_CAPTURE_ORI === "1")
      await page.screenshot({
        path: path.join(repoRoot, "docs/product/assets/studio-vsix-ori-resized-900.png"),
      });
    await webview.locator('.studio-shell-actions button[aria-controls="studio-ori"]').click();
    await webview.locator('.studio-shell-actions button[aria-controls="studio-ori"]').click();
    const restoredOriWidth = (await webview.locator(".studio-ori-dock").boundingBox()).width;
    if (Math.abs(restoredOriWidth - expandedOriWidth) > 2)
      throw new Error("Ori width must survive collapse and reopen");
    await resize.press("ArrowRight");
    const keyboardOriWidth = (await webview.locator(".studio-ori-dock").boundingBox()).width;
    if (keyboardOriWidth > restoredOriWidth - 10) throw new Error("ArrowRight must narrow Ori");
    if (process.env.AGORIX_CAPTURE_VISUAL === "1") {
      for (const [width, height] of [
        [900, 700],
        [1440, 900],
      ]) {
        await page.setViewportSize({ width, height });
        await page.screenshot({
          path: path.join(repoRoot, `docs/product/assets/studio-vsix-list-watchers-${width}.png`),
        });
      }
      await page.setViewportSize({ width: 900, height: 700 });
    }
    console.log("Loaded canonical program, stage and Ori");
    const outerBlock = webview.locator(
      '.studio-program .block[data-pos=\'{"kind":"script","scriptIndex":0}#4\']',
    );
    await outerBlock.press("Alt+ArrowRight");
    await waitForProject(
      (envelope) => envelope.project?.program?.scripts?.[0]?.statements?.[3]?.then?.length === 2,
    );
    await webview
      .locator('.studio-program .block[data-pos*="ifThen"][data-pos$="#1"]')
      .press("Alt+ArrowLeft");
    await waitForProject(
      (envelope) =>
        envelope.project?.program?.scripts?.[0]?.statements?.[3]?.then?.length === 1 &&
        envelope.project.program.scripts[0].statements.length === 6,
    );
    console.log("Nested and outdented a canonical block with the keyboard");
    await webview.locator(".studio-editor-tabs button").filter({ hasText: "Scene" }).click();
    const backdropPicker = webview.locator(".stage-panel .stage-backdrop-picker");
    await backdropPicker.locator("summary").click();
    if ((await backdropPicker.locator(".stage-backdrop-options button").count()) < 9)
      throw new Error("Stage must expose the bundled visual backdrop gallery");
    await backdropPicker.getByRole("button", { name: "Choose backdrop: Forest" }).click();
    await waitForProject(
      (envelope) => envelope.project?.metadata?.stage?.backdropId === "backdrop:forest",
    );
    await webview.locator('.stage-backdrop[data-backdrop-id="backdrop:forest"]').waitFor();
    await backdropPicker.locator("summary").click();
    if (process.env.AGORIX_CAPTURE_BACKDROP_PICKER === "1") {
      for (const [width, height] of [
        [900, 700],
        [1440, 900],
      ]) {
        await page.setViewportSize({ width, height });
        await page.screenshot({
          path: path.join(repoRoot, `docs/product/assets/studio-vsix-backdrop-picker-${width}.png`),
        });
      }
      await page.setViewportSize({ width: 900, height: 700 });
    }
    await backdropPicker.locator("summary").click();
    console.log("Selected and persisted a visual backdrop from the stage");
    await webview
      .locator(".studio-scene-editor .scene-section-tabs button")
      .filter({ hasText: "Sounds" })
      .click();
    assert.equal(
      await webview.locator(".studio-scene-editor section[aria-label='Sounds']").isVisible(),
      true,
    );
    await webview
      .locator(".studio-scene-editor .scene-section-tabs button")
      .filter({ hasText: "Actors" })
      .click();
    await webview
      .locator(".studio-scene-editor .scene-actors button")
      .filter({ hasText: "Helper" })
      .click();
    const actorInspector = webview.locator(".studio-scene-editor .actor-inspector");
    const stageViewportBounds = await webview.locator(".studio-play .stage-viewport").boundingBox();
    if (!stageViewportBounds || stageViewportBounds.y > 390)
      throw new Error("Scene stage must remain visible in the first 900 px viewport");
    assert.equal(await actorInspector.locator("header strong").innerText(), "Helper");
    assert.equal(
      await actorInspector.locator(".actor-properties").evaluate((node) => node.open),
      false,
    );
    assert.equal(await actorInspector.locator(".actor-costume-picker").isVisible(), true);
    const inspectorBounds = await actorInspector.boundingBox();
    if (!inspectorBounds || inspectorBounds.y > 400)
      throw new Error("Selected actor controls must be visible beside Scene in the first viewport");
    assert.equal(await webview.locator(".studio-details .actor-inspector").count(), 0);
    await webview.locator(".scene-create-script button[type='submit']").click();
    const { value: withNewScript } = await waitForProject(
      (envelope) => envelope.project?.program?.scripts?.length === 3,
    );
    const addedScriptId = withNewScript.project.program.scripts.at(-1).id;
    await webview.locator(".studio-editor-tabs button").filter({ hasText: "Build" }).click();
    const newScriptHeading = webview.locator(".script-heading").last();
    const deleteScript = newScriptHeading.getByRole("button", { name: "Delete script" });
    await deleteScript.click();
    assert.equal(JSON.parse(fs.readFileSync(project, "utf8")).project.program.scripts.length, 3);
    await newScriptHeading.getByRole("button", { name: "Confirm delete" }).click();
    await waitForProject(
      (envelope) =>
        envelope.project?.program?.scripts?.length === 2 &&
        !envelope.project.metadata.actors.items
          .find((actor) => actor.id === "actor:helper")
          ?.scripts?.includes(addedScriptId),
    );
    console.log("Created and explicitly removed an actor-owned script");
    await webview.locator(".studio-editor-tabs button").filter({ hasText: "Scene" }).click();
    await webview.getByLabel("Actor name").fill("Temporary actor");
    await webview.getByRole("button", { name: "Add actor" }).click();
    const { value: withTemporaryActor } = await waitForProject((envelope) =>
      envelope.project?.metadata?.actors?.items?.some((actor) => actor.name === "Temporary actor"),
    );
    const temporaryActor = withTemporaryActor.project.metadata.actors.items.find(
      (actor) => actor.name === "Temporary actor",
    );
    const temporaryScriptId = temporaryActor.scripts[0];
    await webview.getByRole("button", { name: "Delete selected actor" }).click();
    assert.equal(
      JSON.parse(fs.readFileSync(project, "utf8")).project.metadata.actors.items.length,
      3,
    );
    await webview
      .getByRole("button", { name: /Confirm delete Temporary actor and 1 script/ })
      .click();
    await waitForProject(
      (envelope) =>
        envelope.project?.metadata?.actors?.items?.length === 2 &&
        !envelope.project.program.scripts.some((script) => script.id === temporaryScriptId),
    );
    await webview
      .locator(".studio-scene-editor .scene-actors button")
      .filter({ hasText: "Helper" })
      .click();
    console.log("Confirmed atomic removal of a temporary actor and its script");
    await webview.locator(".stage-panel .stage-add-character").click();
    await webview
      .locator(".studio-scene-editor .scene-section-tabs button")
      .filter({ hasText: "Costumes" })
      .waitFor();
    const costumeGallery = webview
      .locator(".studio-scene-editor section:not([hidden])")
      .filter({ has: webview.locator(".scene-library-grid") });
    const galleryCount = await costumeGallery.locator(".scene-asset-card").count();
    if (galleryCount < 12) {
      const sectionState = await webview
        .locator(".studio-scene-editor section")
        .evaluateAll((sections) =>
          sections
            .map((section) => ({
              label: section.getAttribute("aria-label"),
              hidden: section.hidden,
              cards: section.querySelectorAll(".scene-asset-card").length,
            }))
            .filter((section) => section.cards > 0),
        );
      throw new Error(
        `Studio must expose the bundled visual character gallery (found ${galleryCount}; sections ${JSON.stringify(sectionState)})`,
      );
    }
    if (process.env.AGORIX_CAPTURE_CHARACTER_ENTRY === "1") {
      for (const [width, height] of [
        [900, 700],
        [1440, 900],
      ]) {
        await page.setViewportSize({ width, height });
        await page.screenshot({
          path: path.join(repoRoot, `docs/product/assets/studio-vsix-character-entry-${width}.png`),
        });
      }
      await page.setViewportSize({ width: 900, height: 700 });
    }
    await costumeGallery.getByLabel("Asset category").selectOption("animals");
    assert.equal(await costumeGallery.locator(".scene-asset-card").count(), 3);
    await costumeGallery.getByLabel("Asset category").selectOption("all");
    await costumeGallery.getByLabel("Search costumes and backdrops").fill("Mika");
    const mikaCard = costumeGallery.locator(".scene-asset-card").filter({ hasText: "Mika" });
    assert.equal(await costumeGallery.locator(".scene-asset-card").count(), 1);
    await mikaCard.getByRole("button", { name: "+ Character: Mika" }).click();
    await waitForProject((envelope) =>
      envelope.project?.metadata?.actors?.items?.some(
        (actor) =>
          actor.name === "Mika" &&
          actor.costumeId === "costume:mika" &&
          actor.scripts?.length === 1,
      ),
    );
    await webview.locator('.stage-sprite[data-costume-id="costume:mika"]').waitFor();
    const costumePicker = webview.locator(".studio-scene-editor .actor-costume-picker");
    await costumePicker.locator("summary").click();
    if ((await costumePicker.locator(".actor-costume-grid button").count()) < 12)
      throw new Error("Actor inspector must expose visual costume choices");
    await costumePicker.getByRole("button", { name: "Choose costume: Pip" }).click();
    await waitForProject((envelope) =>
      envelope.project?.metadata?.actors?.items?.some(
        (actor) => actor.name === "Mika" && actor.costumeId === "costume:pip",
      ),
    );
    await webview.locator('.stage-sprite[data-costume-id="costume:pip"]').waitFor();
    await costumePicker.getByRole("button", { name: "Choose costume: Mika" }).click();
    await waitForProject((envelope) =>
      envelope.project?.metadata?.actors?.items?.some(
        (actor) => actor.name === "Mika" && actor.costumeId === "costume:mika",
      ),
    );
    await webview.locator('.stage-sprite[data-costume-id="costume:mika"]').waitFor();
    const undoChange = webview.getByRole("button", { name: "Undo change" });
    const redoChange = webview.getByRole("button", { name: "Redo change" });
    await undoChange.click();
    await waitForProject((envelope) =>
      envelope.project?.metadata?.actors?.items?.some(
        (actor) => actor.name === "Mika" && actor.costumeId === "costume:pip",
      ),
    );
    await webview.locator('.stage-sprite[data-costume-id="costume:pip"]').waitFor();
    await redoChange.click();
    await waitForProject((envelope) =>
      envelope.project?.metadata?.actors?.items?.some(
        (actor) => actor.name === "Mika" && actor.costumeId === "costume:mika",
      ),
    );
    await webview.locator('.stage-sprite[data-costume-id="costume:mika"]').waitFor();
    if (process.env.AGORIX_CAPTURE_COSTUME_PICKER === "1") {
      for (const [width, height] of [
        [900, 700],
        [1440, 900],
      ]) {
        await page.setViewportSize({ width, height });
        await page.screenshot({
          path: path.join(repoRoot, `docs/product/assets/studio-vsix-costume-picker-${width}.png`),
        });
      }
      await page.setViewportSize({ width: 900, height: 700 });
    }
    console.log("Selected and persisted visual costumes from the actor inspector");
    if (process.env.AGORIX_CAPTURE_GALLERY === "1") {
      for (const [width, height] of [
        [900, 700],
        [1440, 900],
      ]) {
        await page.setViewportSize({ width, height });
        await page.screenshot({
          path: path.join(repoRoot, `docs/product/assets/studio-vsix-gallery-${width}.png`),
        });
      }
      await page.setViewportSize({ width: 900, height: 700 });
    }
    await costumeGallery.getByLabel("Search costumes and backdrops").fill("");
    await webview
      .locator(".studio-scene-editor .scene-section-tabs button")
      .filter({ hasText: "Actors" })
      .click();
    await webview
      .locator(".studio-scene-editor .scene-actors button")
      .filter({ hasText: "Helper" })
      .click();
    await webview
      .locator(".studio-scene-editor .scene-section-tabs button")
      .filter({ hasText: "Costumes" })
      .click();
    console.log("Filtered bundled gallery and created a visible actor with its chosen costume");
    await webview.locator(".studio-scene-editor .scene-create-shortcut:visible").click();
    await webview.getByLabel("Image name").fill("My painted star");
    const drawing = webview.locator(".studio-scene-editor canvas[aria-label='Draw image']");
    await drawing.scrollIntoViewIfNeeded();
    const bounds = await drawing.boundingBox();
    if (!bounds) throw new Error("Drawing canvas not visible");
    await page.mouse.move(bounds.x + 20, bounds.y + 20);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 80, bounds.y + 60, { steps: 5 });
    await page.mouse.up();
    assert.equal(
      await drawing.evaluate((canvas) =>
        canvas
          .getContext("2d")
          .getImageData(0, 0, canvas.width, canvas.height)
          .data.some((value, index) => index % 4 === 3 && value > 0),
      ),
      true,
      "The pointer stroke must reach the drawing canvas",
    );
    await webview.getByRole("button", { name: "Save drawing" }).click();
    await page.getByText("I am an adult and approve").click();
    await page.keyboard.press("Escape");
    await costumeGallery
      .getByRole("button", { name: "Choose costume: My painted star" })
      .waitFor({ timeout: 5000 });
    await costumeGallery
      .getByRole("button", { name: "Choose costume: My painted star" })
      .click({ timeout: 5000 });
    console.log("Created and selected a painted costume");
    const { raw: beforeEdit, value: originalEnvelope } = await waitForProject((envelope) => {
      const asset = envelope.project?.metadata?.assets?.find(
        (item) => item.name === "My painted star",
      );
      return (
        asset !== undefined &&
        envelope.project.metadata.actors?.items?.some(
          (actor) => actor.id === "actor:helper" && actor.costumeId === asset.id,
        )
      );
    });
    const paintedAsset = originalEnvelope.project.metadata.assets.find(
      (asset) => asset.name === "My painted star",
    );
    if (!paintedAsset) throw new Error("Painted asset missing before edit");
    const editButton = webview
      .locator(".studio-scene-editor .scene-asset-card")
      .filter({ hasText: "My painted star" })
      .getByRole("button", { name: "Edit image" });
    await editButton.click();
    await webview.getByRole("button", { name: "Cancel edit" }).click();
    assert.equal(fs.readFileSync(project, "utf8"), beforeEdit);
    await editButton.click();
    await drawing.evaluate(async (canvas) => {
      const context = canvas.getContext("2d");
      for (let attempt = 0; attempt < 100; attempt++) {
        if (
          context &&
          context
            .getImageData(0, 0, canvas.width, canvas.height)
            .data.some((value, index) => index % 4 === 3 && value > 0)
        )
          return;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error("Existing costume did not load into the drawing canvas");
    });
    if (process.env.AGORIX_CAPTURE_VISUAL === "1") {
      for (const [width, height] of [
        [900, 700],
        [1440, 900],
      ]) {
        await page.setViewportSize({ width, height });
        await page.screenshot({
          path: path.join(repoRoot, `docs/product/assets/studio-vsix-edit-costume-${width}.png`),
        });
      }
      await page.setViewportSize({ width: 900, height: 700 });
    }
    const editBounds = await drawing.boundingBox();
    if (!editBounds) throw new Error("Costume editor not visible");
    await page.mouse.move(editBounds.x + 110, editBounds.y + 40);
    await page.mouse.down();
    await page.mouse.move(editBounds.x + 130, editBounds.y + 70, { steps: 5 });
    await page.mouse.up();
    await webview.getByRole("button", { name: "Save changes" }).click();
    await page.getByText("I am an adult and approve").click();
    await page.keyboard.press("Escape");
    await webview.getByRole("button", { name: "Save changes" }).waitFor({ state: "hidden" });
    const { value: editedEnvelope } = await waitForProject(
      (envelope) => envelope.media?.[paintedAsset.id] !== originalEnvelope.media[paintedAsset.id],
    );
    assert.notEqual(editedEnvelope.media[paintedAsset.id], originalEnvelope.media[paintedAsset.id]);
    assert.equal(
      editedEnvelope.project.metadata.assets.filter((asset) => asset.id === paintedAsset.id).length,
      1,
    );
    console.log("Edited the same costume without changing its ID");
    await webview
      .locator(".studio-scene-editor .scene-section-tabs button")
      .filter({ hasText: "Actors" })
      .click();
    await webview
      .locator(".studio-scene-editor .scene-actors button")
      .filter({ hasText: "Explorer" })
      .click();
    await webview.locator(".studio-editor-tabs button").filter({ hasText: "Build" }).click();
    const paletteBounds = await webview.locator(".studio-tools").boundingBox();
    const targetBounds = await webview.locator(".studio-program").boundingBox();
    if (
      !paletteBounds ||
      !targetBounds ||
      paletteBounds.x < targetBounds.x + targetBounds.width - 10
    )
      throw new Error("Open block palette must leave the program available for dropping blocks");
    await webview.locator('.palette button[aria-label="add numbers"]').click();
    await webview.locator(".studio-program .numeric-place").first().click();
    await waitForProject((envelope) =>
      envelope.project?.program?.scripts
        ?.find((script) => script.id === "main")
        ?.statements?.some(
          (statement) => statement.type === "setVariable" && statement.value?.type === "add",
        ),
    );
    await webview.locator(".studio-shell-actions button").filter({ hasText: "Hide tools" }).click();
    await webview.getByRole("button", { name: "Undo change" }).click();
    await waitForProject((envelope) =>
      envelope.project?.program?.scripts
        ?.find((script) => script.id === "main")
        ?.statements?.some(
          (statement) =>
            statement.type === "setVariable" &&
            statement.value?.type === "numericLiteral" &&
            statement.value.value === 1,
        ),
    );
    console.log("Placed a visual numeric reporter and restored the canonical value");
    await webview.locator(".studio-shell-actions button").filter({ hasText: "Show tools" }).click();
    await webview.locator('.palette button[aria-label="math function"]').click();
    await webview.locator(".studio-program .numeric-place").first().click();
    const mathFunction = webview.locator(".studio-program .math-function-fields").first();
    await mathFunction.getByRole("combobox", { name: / Function$/ }).selectOption("round");
    await waitForProject((envelope) =>
      envelope.project?.program?.scripts
        ?.find((script) => script.id === "main")
        ?.statements?.some(
          (statement) =>
            statement.type === "setVariable" &&
            statement.value?.type === "mathFunction" &&
            statement.value.function === "round",
        ),
    );
    await mathFunction.getByRole("spinbutton").fill("3.5");
    await mathFunction.getByRole("spinbutton").press("Tab");
    await waitForProject((envelope) =>
      envelope.project?.program?.scripts
        ?.find((script) => script.id === "main")
        ?.statements?.some(
          (statement) =>
            statement.type === "setVariable" &&
            statement.value?.type === "mathFunction" &&
            statement.value.function === "round" &&
            statement.value.value?.value === 3.5,
        ),
    );
    await webview.locator(".studio-shell-actions button").filter({ hasText: "Hide tools" }).click();
    for (let edit = 0; edit < 3; edit += 1)
      await webview.getByRole("button", { name: "Undo change" }).click();
    await waitForProject((envelope) =>
      envelope.project?.program?.scripts
        ?.find((script) => script.id === "main")
        ?.statements?.some(
          (statement) =>
            statement.type === "setVariable" &&
            statement.value?.type === "numericLiteral" &&
            statement.value.value === 1,
        ),
    );
    console.log("Selected, configured and undid a visual math function");
    await webview.locator(".studio-shell-actions button").filter({ hasText: "Show tools" }).click();
    const move = webview
      .locator(".palette button[draggable='true']")
      .filter({ hasText: "Move" })
      .first();
    const before = await webview.locator(".studio-program .block").count();
    let after = before;
    for (const position of ["last", "first", "last"]) {
      const slot = webview.locator(".studio-program .slot")[position]();
      await move.dragTo(slot);
      await page.waitForTimeout(350);
      after = await webview.locator(".studio-program .block").count();
      if (after > before) break;
    }
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
    const beforeOri = JSON.parse(fs.readFileSync(project, "utf8"));
    await page.keyboard.press("F1");
    await page.locator(".quick-input-widget input").first().fill(">Build Proposal");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Apply", exact: true }).click({ timeout: 15000 });
    const { value: afterOri } = await waitForProject(
      (envelope) =>
        envelope.project?.program?.scripts?.[0]?.statements?.length ===
        beforeOri.project.program.scripts[0].statements.length + 1,
    );
    assert.deepEqual(afterOri.project.program.scripts[0].statements.at(-1), {
      type: "turn",
      degrees: 90,
    });
    assert.ok(boundaryCalls.includes("builder"), "Installed VSIX did not request Ori builder");
    await page.locator(".tab").filter({ hasText: "visual.agorix" }).first().click();
    await webview.locator(".execution-toolbar button").filter({ hasText: "Play" }).click();
    await webview.locator(".execution-readout").filter({ hasText: "completed" }).waitFor();
    console.log("Accepted a provider-backed Ori proposal and ran the canonical program");
    const watcher = webview.locator('.stage-list-watcher[data-list-id="inventory"]');
    assert.deepEqual(await watcher.locator("li").allTextContents(), ["2", "5"]);
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
    assert.equal(reopened.metadata.stage.backdropId, "backdrop:forest");
    const expectedAssets = saved.project.metadata.assets.map((asset) => ({
      ...asset,
      source: asset.source.startsWith("embedded:") ? saved.media[asset.id] : asset.source,
    }));
    assert.deepEqual(reopened.metadata.assets, expectedAssets);
    const painted = expectedAssets.find((asset) => asset.name === "My painted star");
    if (!painted) throw new Error("Painted costume missing after Web import");
    assert.equal(await webPage.getByTestId("stage-sprite").count(), 3);
    await webPage.locator('[data-testid="stage-sprite"][data-costume-id="costume:mika"]').waitFor();
    await webPage
      .locator(`[data-testid="stage-sprite"][data-costume-id="${painted.id}"]`)
      .first()
      .waitFor({ timeout: 5000 });
    await webPage.locator(".stage-panel").getByRole("button", { name: "Run", exact: true }).click();
    await webPage.locator('[data-fact-source="runtime"]').first().waitFor({ timeout: 20000 });
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
    await new Promise((resolve) => boundary.close(resolve));
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
