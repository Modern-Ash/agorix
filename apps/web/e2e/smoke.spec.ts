import { expect, test, type Page } from "@playwright/test";

async function applyMoveSteps(page: Page, value: string) {
  await page.getByLabel("Move block").getByRole("spinbutton").fill(value);
  await page
    .getByRole("button", { name: /^(Apply value|Aplicar valor)$/ })
    .first()
    .click();
}

async function canonicalHash(page: Page) {
  return page.getByTestId("canonical-hash").getAttribute("data-canonical-hash");
}

function visibleCode(page: Page, code: string) {
  return page.locator(".code-surface", { hasText: code });
}

function codeHeading(page: Page, name = "Code") {
  return page.getByRole("heading", { name, exact: true }).first();
}

async function dragHtml5(page: Page, sourceSelector: string, targetSelector: string) {
  await page.evaluate(
    ({ sourceSelector, targetSelector }) => {
      const source = document.querySelector(sourceSelector);
      const target = document.querySelector(targetSelector);
      if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) {
        throw new Error(`Missing drag target: ${sourceSelector} -> ${targetSelector}`);
      }
      const dataTransfer = new DataTransfer();
      source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer }));
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer }));
      target.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer }));
    },
    { sourceSelector, targetSelector },
  );
}

function codeProjectionSelect(page: Page) {
  return page.getByLabel("Code projection", { exact: true });
}

async function runTransparencyJourney(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.goto("/");

  await page.getByRole("button", { name: "Move" }).click();
  await applyMoveSteps(page, "24");
  await expect(visibleCode(page, "sprite.move(24);")).toBeVisible();
  await expect(codeHeading(page)).toBeVisible();
  const beforeHash = await canonicalHash(page);

  await page.getByRole("button", { name: "Preview proposal" }).click();
  await expect(page.getByTestId("proposal-preview")).toBeVisible();
  await expect(
    page.getByText("Proposal preview ready. Your program has not changed."),
  ).toBeVisible();
  await expect(visibleCode(page, "sprite.move(24);")).toBeVisible();
  await expect(page.getByTestId("proposal-preview").getByText("sprite.move(160);")).toBeVisible();
  expect(await canonicalHash(page)).toBe(beforeHash);

  await page.getByRole("button", { name: "Reject proposal" }).click();
  await expect(page.getByText("Proposal rejected. Your program stayed the same.")).toBeVisible();
  await expect(visibleCode(page, "sprite.move(24);")).toBeVisible();
  expect(await canonicalHash(page)).toBe(beforeHash);

  await page.getByRole("button", { name: "Preview proposal" }).click();
  await page.getByRole("button", { name: "Accept proposal" }).click();
  await expect(
    page.getByText("Proposal accepted. Blocks and code updated from canonical state."),
  ).toBeVisible();
  await expect(page.getByLabel("Move block").getByRole("spinbutton")).toHaveValue("160");
  await expect(visibleCode(page, "sprite.move(160);")).toBeVisible();
  expect(await canonicalHash(page)).not.toBe(beforeHash);

  await page.getByRole("button", { name: "Step" }).click();
  await page.getByRole("button", { name: "Step" }).click();
  await expect(page.locator(".block-card.active")).toContainText("Move");
  await expect(page.locator(".code-surface mark")).toContainText("sprite.move(160);");
  await expect(page.getByText("Nova moved right; x: 52 -> 212")).toBeVisible();

  await page.setViewportSize({ width: viewport.height, height: viewport.width });
  await expect(visibleCode(page, "sprite.move(160);")).toBeVisible();
  await expect(codeHeading(page)).toBeVisible();

  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByText("Mission complete: your sprite reached the goal.")).toBeVisible({
    timeout: 5000,
  });
}

test("main editor shell renders persistent blocks, stage and code", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /^(Build with blocks\. See the code\.|Construye con bloques\. Mira el código\.)$/,
    }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Action palette", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "When you press Run" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stage" })).toBeVisible();
  await expect(codeHeading(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Run" })).toBeVisible();
  await expect(page.locator(".brand-identity")).toHaveAccessibleName("Agorix");
  await expect(page.locator(".brand-wordmark")).toHaveText("Agorix");
});

test("block edits update generated code", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Move" }).click();
  await expect(page.getByText("sprite.move(10);")).toBeVisible();
  await applyMoveSteps(page, "24");
  await expect(visibleCode(page, "sprite.move(24);")).toBeVisible();
});

test("block edits survive reload from canonical storage", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Move" }).click();
  await applyMoveSteps(page, "24");
  await expect(visibleCode(page, "sprite.move(24);")).toBeVisible();

  const stored = await page.evaluate(() => localStorage.getItem("agorix:default-project"));
  expect(stored).toContain('"program"');
  expect(stored).toContain('"metadata"');
  expect(stored).not.toContain("sprite.move");

  await page.reload();

  await expect(page.getByLabel("Move block").getByRole("spinbutton")).toHaveValue("24");
  await expect(visibleCode(page, "sprite.move(24);")).toBeVisible();
});

test("locale switch localizes UI without changing canonical program", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Move" }).click();
  await applyMoveSteps(page, "24");
  const before = await page.evaluate(() => localStorage.getItem("agorix:default-project"));
  const beforeProgram = JSON.parse(before ?? "{}").program;

  await page.getByLabel("Product language").selectOption("es");

  await expect(
    page.getByRole("heading", { name: "Construye con bloques. Mira el código." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Ejecutar" })).toBeVisible();
  await expect(codeHeading(page, "Código")).toBeVisible();
  await expect(page.getByLabel("Bloque Mover").getByRole("spinbutton")).toHaveValue("24");

  const after = await page.evaluate(() => localStorage.getItem("agorix:default-project"));
  const parsedAfter = JSON.parse(after ?? "{}");
  expect(parsedAfter.program).toEqual(beforeProgram);
  expect(JSON.stringify(parsedAfter.program)).not.toContain("locale");
  expect(parsedAfter.metadata.locale).toBe("es");
});

test("offline tutor hints escalate without changing blocks", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Move" }).click();
  await expect(page.getByLabel("Move block").getByRole("spinbutton")).toHaveValue("10");

  await page.getByRole("button", { name: "Get hint" }).click();
  await expect(page.getByText("Hint level 1 of 5")).toBeVisible();
  await expect(page.getByText("Hints used: 1")).toBeVisible();
  await expect(page.getByText("What changed on the stage after Run")).toBeVisible();
  await expect(
    page.locator(".code-surface mark").filter({ hasText: "sprite.move(10);" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Get hint" }).click();
  await expect(page.getByText("Hint level 2 of 5")).toBeVisible();
  await expect(page.getByText("Hints used: 2")).toBeVisible();
  await expect(page.getByText("Compare that number with the distance to the goal")).toBeVisible();
  await expect(page.getByLabel("Move block").getByRole("spinbutton")).toHaveValue("10");
});

test("first mission completes from runtime facts and shows reflection", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Move" }).click();
  await applyMoveSteps(page, "10");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByText("stopped short")).toBeVisible({ timeout: 5000 });

  await applyMoveSteps(page, "160");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByText("Mission complete: your sprite reached the goal.")).toBeVisible({
    timeout: 5000,
  });
  await expect(
    page.getByText("Reflection: What number made the sprite reach the goal"),
  ).toBeVisible();
  await expect(visibleCode(page, "sprite.move(160);")).toBeVisible();
});

test("mission retry keeps work, code, and unlocks non-blocking free play", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Move" }).click();
  await applyMoveSteps(page, "10");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByText("stopped short")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Attempts: 1")).toBeVisible();
  await expect(page.getByText("sprite.move(10);")).toBeVisible();

  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByLabel("Move block").getByRole("spinbutton")).toHaveValue("10");
  await expect(page.getByText("sprite.move(10);")).toBeVisible();

  await applyMoveSteps(page, "160");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByText("Mission complete: your sprite reached the goal.")).toBeVisible({
    timeout: 5000,
  });
  await page.getByRole("button", { name: "Keep building" }).click();
  await expect(
    page.getByText("Free play unlocked. Keep experimenting with your program."),
  ).toBeVisible();
  await expect(visibleCode(page, "sprite.move(160);")).toBeVisible();
});

test("Step synchronizes block, code and stage without racing Run", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Move" }).click();
  await applyMoveSteps(page, "24");
  await page.getByRole("button", { name: "Step" }).click();

  await expect(page.getByTestId("step-readout")).toContainText("before-statement");
  await expect(page.locator(".block-card.active")).toContainText("Move");
  await expect(page.locator(".code-surface mark")).toContainText("sprite.move(24);");

  await page.getByRole("button", { name: "Step" }).click();
  await expect(page.getByTestId("step-readout")).toContainText("after-statement");
  await expect(page.getByText("Current node: sprite.move(24);")).toBeVisible();

  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("button", { name: "Step" })).toBeDisabled();
});

test("orientation change preserves prepared Step state", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/");

  await page.getByRole("button", { name: "Move" }).click();
  await applyMoveSteps(page, "24");
  await page.getByRole("button", { name: "Step" }).click();
  await expect(page.getByTestId("step-readout")).toContainText("scripts[0]/statements[0]");

  await page.setViewportSize({ width: 1180, height: 820 });
  await page.evaluate(() => window.scrollTo(0, 0));

  await expect(page.getByTestId("step-readout")).toContainText("scripts[0]/statements[0]");
  await expect(page.locator(".code-surface mark")).toContainText("sprite.move(24);");
  await expect(page.locator(".block-card.active")).toContainText("Move");
});

test("Step trace explains before and after state without raw logs", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Move" }).click();
  await applyMoveSteps(page, "24");
  await page.getByRole("button", { name: "Step" }).click();
  await page.getByRole("button", { name: "Step" }).click();

  const card = page.getByTestId("step-card");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Step 2 of");
  await expect(card).toContainText("Nova moved right; x: 52 -> 76");
  await expect(card).toContainText("Before: x 52, y 128, heading 0");
  await expect(card).toContainText("After: x 76, y 128, heading 0");
  await expect(page.getByRole("heading", { name: "Trace" })).toHaveCount(0);
  await expect(page.getByText(/provider|prompt|stack/i)).toHaveCount(0);
});

test("transparency journey preserves visible code and explicit proposal control on desktop", async ({
  page,
}) => {
  await runTransparencyJourney(page, { width: 1280, height: 900 });
});

test("transparency journey works on large tablet 1366x1024", async ({ page }) => {
  await runTransparencyJourney(page, { width: 1366, height: 1024 });
});

test("transparency journey is touch-safe on tablet portrait", async ({ page }) => {
  await runTransparencyJourney(page, { width: 768, height: 1024 });
});

test("transparency journey is touch-safe on tablet landscape", async ({ page }) => {
  await runTransparencyJourney(page, { width: 1024, height: 768 });
});

test("mission celebration respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const reducedAnimationSeconds = await page.locator(".stage-canvas .goal").evaluate((node) => {
    const duration = window.getComputedStyle(node).animationDuration;
    return duration.endsWith("ms")
      ? Number.parseFloat(duration) / 1000
      : Number.parseFloat(duration);
  });

  expect(reducedAnimationSeconds).toBeLessThanOrEqual(0.001);
});

test("tablet landscape uses a Scratch-style left tool palette with World and Code primary", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");

  const world = page.getByRole("heading", { name: "Stage" });
  const code = codeHeading(page);
  const palette = page.getByRole("heading", { name: "Action palette", exact: true });

  await expect(world).toBeInViewport();
  await expect(code).toBeInViewport();
  await expect(palette).toBeVisible();
  await expect(page.getByRole("heading", { name: "Blocks", exact: true })).toHaveCount(0);

  const stageBox = await page.locator(".stage-panel").boundingBox();
  const codeBox = await page.locator(".code-panel").first().boundingBox();
  const paletteBox = await page.locator(".action-palette").boundingBox();
  expect(stageBox).not.toBeNull();
  expect(codeBox).not.toBeNull();
  expect(paletteBox).not.toBeNull();
  expect(stageBox!.width).toBeGreaterThan(360);
  expect(codeBox!.width).toBeGreaterThan(300);
  expect(paletteBox!.x).toBeLessThan(stageBox!.x);
});

test("tablet portrait shows World before inspectable Code in normal flow", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Stage" })).toBeInViewport();
  await expect(codeHeading(page)).toBeInViewport();

  const stageBox = await page.locator(".stage-panel").boundingBox();
  const codeBox = await page.locator(".code-panel").first().boundingBox();
  expect(stageBox).not.toBeNull();
  expect(codeBox).not.toBeNull();
  expect(stageBox!.y).toBeLessThan(codeBox!.y);
  await expect(page.locator(".code-surface")).toBeVisible();
});

test("tablet controls meet touch target guidance", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/");

  for (const name of ["Run", "Step", "Stop", "Reset"]) {
    const box = await page.getByRole("button", { name, exact: true }).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});

test("orientation change preserves canonical program and visible code", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/");

  await page.getByRole("button", { name: "Move" }).click();
  await applyMoveSteps(page, "24");
  await expect(visibleCode(page, "sprite.move(24);")).toBeVisible();

  await page.setViewportSize({ width: 1180, height: 820 });
  await page.evaluate(() => window.scrollTo(0, 0));

  await expect(page.getByLabel("Move block").getByRole("spinbutton")).toHaveValue("24");
  await expect(visibleCode(page, "sprite.move(24);")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stage" })).toBeInViewport();
  await expect(codeHeading(page)).toBeInViewport();
});

test("touch/no-drag path completes the First Mission", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/");

  await page.getByRole("button", { name: "Move" }).click();
  await applyMoveSteps(page, "160");
  await expect(visibleCode(page, "sprite.move(160);")).toBeVisible();

  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByText("Mission complete: your sprite reached the goal.")).toBeVisible({
    timeout: 5000,
  });
});

test("explicit reorder controls update generated code without drag", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Move" }).click();
  await page.getByRole("button", { name: "Turn" }).click();
  await expect(page.getByText("sprite.move(10);")).toBeVisible();
  await expect(page.getByText("sprite.turn(90);")).toBeVisible();

  await page.getByLabel("Move block").getByRole("button", { name: "Down" }).click();

  const code = await page.locator(".code-surface").innerText();
  expect(code.indexOf("sprite.turn(90);")).toBeLessThan(code.indexOf("sprite.move(10);"));
});

test("palette shows only implemented actions, in familiar categories", async ({ page }) => {
  await page.goto("/");

  for (const name of ["Motion", "Control"]) {
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }
  for (const name of [
    "Looks",
    "Sound",
    "Events",
    "Sensing",
    "Operators",
    "Variables",
    "My Blocks",
  ]) {
    await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole("button", { name: "Say", exact: true })).toHaveCount(0);
  await expect(page.locator(".action-palette button:disabled")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Move", exact: true })).toBeEnabled();
});

test("IDE panels can collapse, close, restore, and blocks support drag and drop", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByLabel("Tools panel controls")
    .getByRole("button", { name: "Collapse Tools" })
    .click();
  await expect(page.getByRole("button", { name: "Move", exact: true })).toBeHidden();
  await page
    .getByLabel("Tools panel controls")
    .getByRole("button", { name: "Expand Tools" })
    .click();
  await expect(page.getByRole("button", { name: "Move", exact: true })).toBeVisible();

  await expect(page.getByRole("heading", { name: "Trace" })).toHaveCount(0);
  await page.getByRole("button", { name: "Trace" }).click();
  await expect(page.getByRole("heading", { name: "Trace" })).toBeVisible();

  await dragHtml5(page, ".tool-motion_move", ".block-stack");
  await expect(page.getByLabel("Move block")).toBeVisible();
  await dragHtml5(page, ".tool-motion_turn", ".block-stack");
  await expect(page.getByLabel("Turn block")).toBeVisible();

  await dragHtml5(page, '[aria-label="Turn block"]', '[aria-label="Move block"]');
  const code = await page.locator(".code-surface").innerText();
  expect(code.indexOf("sprite.turn(90);")).toBeLessThan(code.indexOf("sprite.move(10);"));
});

test("IDE panels can maximize and expose resize affordances", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator(".program-panel")).toHaveCSS("resize", "both");
  await page
    .getByLabel("Code panel controls")
    .getByRole("button", { name: "Maximize Code" })
    .click();

  const codePanelBox = await page.locator(".code-panel").boundingBox();
  expect(codePanelBox).not.toBeNull();
  expect(codePanelBox!.width).toBeGreaterThan(900);
  expect(codePanelBox!.height).toBeGreaterThan(600);
  await expect(page.locator(".code-panel")).toHaveCSS("position", "fixed");

  await page
    .getByLabel("Code panel controls")
    .getByRole("button", { name: "Restore Code" })
    .click();
  await expect(page.locator(".code-panel")).not.toHaveClass(/panel-maximized/);
});

test("workflow rail relates tools, blocks, stage, code and AI", async ({ page }) => {
  await page.goto("/");

  for (const label of ["Choose", "Build", "Test", "Inspect", "Coach"]) {
    await expect(page.locator(".learning-flow").getByText(label, { exact: true })).toBeVisible();
  }

  await expect(page.locator(".learning-flow .flow-step.active")).toHaveCount(2);
  await page.locator(".action-palette").getByLabel("Move", { exact: true }).click();
  await expect(page.locator(".learning-flow .flow-step.active")).toHaveCount(3);
});

test("desktop IDE keeps AI visible without document-level scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 820 });
  await page.goto("/");

  const metrics = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
  }));
  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.innerHeight + 2);

  const codeBox = await page.locator(".code-panel").boundingBox();
  const aiBox = await page.locator(".companion-panel").boundingBox();
  expect(codeBox).not.toBeNull();
  expect(aiBox).not.toBeNull();
  expect(aiBox!.x).toBeGreaterThan(codeBox!.x);
  await expect(page.getByRole("heading", { name: "AI coach", exact: true })).toBeInViewport();
});

test("Explain tool reveals the AI companion without a mode switch", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("navigation", { name: /Work mode/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Close AI" }).click();
  await expect(page.locator(".companion-panel")).toHaveCount(0);
  await page.getByRole("button", { name: "Use AI explain tool" }).click();
  await expect(page.locator(".companion-panel")).toBeVisible();
});

test("adding a block refreshes coach and starter guidance", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Add Move to start the mission.")).toBeVisible();
  await page.locator(".action-palette").getByLabel("Move", { exact: true }).click();

  await expect(page.getByText("Add Move to start the mission.")).toHaveCount(0);
  await expect(page.getByText("Run your idea and watch what the stage proves.")).toBeVisible();
  await expect(page.getByText("Block added. Run it to test your idea on the stage.")).toBeVisible();
});

test("AI coach exposes a provider connection entry point", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Connect AI" }).click();
  await expect(page.getByText("Connect a real AI provider")).toBeVisible();
  await expect(page.getByText("Not configured yet")).toBeVisible();

  await page.getByRole("button", { name: "Keep local mode" }).click();
  await expect(page.getByText("Connect a real AI provider")).toHaveCount(0);
});

test("virtual keyboard numeric edit keeps apply and cancel controls visible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByRole("button", { name: "Move" }).click();
  await page.getByLabel("Move block").getByRole("spinbutton").focus();

  await expect(page.getByRole("button", { name: "Apply value" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel edit" })).toBeVisible();
});

test("Spanish touch edit path keeps action palette and numeric commit usable", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/");

  await page.getByLabel("Product language").selectOption("es");
  await page.getByRole("button", { name: "Mover" }).click();
  await page.getByLabel("Bloque Mover").getByRole("spinbutton").fill("160");
  await page.getByRole("button", { name: "Aplicar valor" }).click();

  await expect(visibleCode(page, "sprite.move(160);")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Paleta de acciones" })).toBeVisible();
});

test("app is installable: manifest is linked and valid, service worker registers", async ({
  page,
}) => {
  await page.goto("/");

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifestHref).toBe("/manifest.webmanifest");

  const manifestResponse = await page.request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");
  expect(Array.isArray(manifest.icons)).toBe(true);
  expect(manifest.icons.length).toBeGreaterThan(0);

  await page.waitForFunction(
    () => navigator.serviceWorker.getRegistration().then((r) => r !== undefined),
    { timeout: 5000 },
  );
  const controlled = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active !== null;
  });
  expect(controlled).toBe(true);
});

test("app shell stays available offline after the service worker installs", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForLoadState("networkidle");
  // Reload once more with the SW active so its fetch handler caches every asset this page requested.
  await page.reload();
  await page.waitForLoadState("networkidle");

  await context.setOffline(true);
  await page.reload();

  await expect(
    page.getByRole("heading", { name: "Build with blocks. See the code." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Run" })).toBeVisible();

  await context.setOffline(false);
});

test("provenance is visually and textually distinguishable across suggestion, accepted and runtime-fact states (issue #99)", async ({
  page,
}) => {
  await page.goto("/");

  // Initial state: no AI content shown yet, tutor marked unavailable.
  await expect(page.locator('[data-provenance="unavailable"]')).toBeVisible();
  await expect(page.locator('[data-provenance="suggestion"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Move" }).click();
  await applyMoveSteps(page, "24");

  // A proposal preview is an explicit, labeled suggestion — not yet applied.
  await page.getByRole("button", { name: "Preview proposal" }).click();
  const suggestion = page.locator('[data-provenance="suggestion"]');
  await expect(suggestion).toBeVisible();
  await expect(suggestion).toContainText("not applied yet");
  await expect(page.locator('[data-provenance="accepted"]')).toHaveCount(0);

  // Accepting it flips the label to accepted; the suggestion badge disappears with the card.
  await page.getByRole("button", { name: "Accept proposal" }).click();
  await expect(page.locator('[data-provenance="accepted"]')).toBeVisible();
  await expect(page.locator('[data-provenance="suggestion"]')).toHaveCount(0);

  // Running the program produces a runtime-fact label distinct from both AI states.
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.locator('[data-provenance="runtime-fact"]')).toBeVisible({ timeout: 5000 });
});

test("AI-literacy journey predicts, tests, challenges and corrects an imperfect suggestion", async ({
  page,
}) => {
  await page.goto("/");

  // Establish learner-owned program state before any AI suggestion.
  await page.getByRole("button", { name: "Move" }).click();
  await applyMoveSteps(page, "24");
  const learnerHash = await canonicalHash(page);

  // Deterministic AI fixture proposes a plausible but wrong value.
  await page.getByRole("button", { name: "Try an AI suggestion" }).click();
  const proposal = page.getByTestId("proposal-preview");
  await expect(proposal).toBeVisible();
  await expect(proposal.getByText("AI suggestion — not applied yet")).toBeVisible();
  await expect(proposal.getByText("sprite.move(120);")).toBeVisible();
  expect(await canonicalHash(page)).toBe(learnerHash);

  // Passive acceptance is impossible: the learner must make an evaluative prediction.
  const accept = page.getByRole("button", { name: "Accept proposal" });
  await expect(accept).toBeDisabled();
  await page.getByRole("button", { name: "I predict this will reach the goal" }).click();
  await expect(page.getByTestId("ai-prediction-recorded")).toBeVisible();
  await expect(accept).toBeEnabled();

  // Acceptance changes canonical state, but does not mark the suggestion as runtime truth.
  await accept.click();
  await expect(visibleCode(page, "sprite.move(120);")).toBeVisible();
  expect(await canonicalHash(page)).not.toBe(learnerHash);

  // Deterministic runtime disproves the prediction.
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByText("stopped short")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Runtime result — actually happened")).toBeVisible();

  // Runtime evidence is inspectable; debugger/hint must reason from the run, not invent a fact.
  await page.getByRole("button", { name: "Step" }).click();
  await page.getByRole("button", { name: "Step" }).click();
  await expect(page.getByTestId("step-card")).toBeVisible();
  await page.getByRole("button", { name: "Get hint" }).click();
  await expect(page.getByText("Hint level 1 of 5")).toBeVisible();

  // Learner corrects the accepted program explicitly.
  await applyMoveSteps(page, "160");
  await expect(visibleCode(page, "sprite.move(160);")).toBeVisible();
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByText("Mission complete: your sprite reached the goal.")).toBeVisible({
    timeout: 5000,
  });

  // Reflection makes the AI-literacy objective explicit.
  await expect(
    page.getByText(
      "Reflection: What was wrong with the original AI suggestion, and what evidence proved it?",
    ),
  ).toBeVisible();
});

test.describe("MVP release happy paths", () => {
  test("happy path: learner builds, runs, completes and reflects", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Move" }).click();
    await applyMoveSteps(page, "160");
    await expect(visibleCode(page, "sprite.move(160);")).toBeVisible();
    await page.getByRole("button", { name: "Run" }).click();
    await expect(page.getByText("Mission complete: your sprite reached the goal.")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(/Reflection:/)).toBeVisible();
  });

  test("happy path: one canonical program switches and compares code projections", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Move" }).click();
    await applyMoveSteps(page, "24");
    const before = await canonicalHash(page);

    await codeProjectionSelect(page).selectOption("agorix-code");
    await expect(visibleCode(page, "move 24")).toBeVisible();
    expect(await canonicalHash(page)).toBe(before);

    await page.getByLabel("Compare code projection").selectOption("python");
    await expect(visibleCode(page, "move(24)")).toBeVisible();
    expect(await canonicalHash(page)).toBe(before);

    await codeProjectionSelect(page).selectOption("typescript");
    await expect(visibleCode(page, "sprite.move(24);")).toBeVisible();
    expect(await canonicalHash(page)).toBe(before);
  });

  test("happy path: deterministic Learning Decision Plane bypasses provider work", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Move" }).click();
    await page.getByRole("button", { name: "Run" }).click();
    await page.getByRole("button", { name: "Get hint" }).click();

    const shell = page.locator("main.editor-shell");
    await expect(shell).toHaveAttribute("data-learning-capability", "coach");
    await expect(shell).toHaveAttribute("data-provider-selection-bypassed", /true|false/);
    await expect(page.getByText("Hint level 1 of 5")).toBeVisible();
  });

  test("happy path: coach hint records deterministic routing metadata", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Move" }).click();
    await page.getByRole("button", { name: "Get hint" }).click();

    const shell = page.locator("main.editor-shell");
    await expect(shell).toHaveAttribute("data-learning-capability", "coach");
    await expect(shell).toHaveAttribute("data-generative-needed", "yes");
    await expect(shell).toHaveAttribute("data-reasoning-tier", "local");
    await expect(shell).toHaveAttribute("data-provider-selection-bypassed", "false");
    await expect(page.getByText("Hint level 1 of 5")).toBeVisible();
  });
});

async function buildRepetitiveProgram(page: Page) {
  await page.goto("/");
  for (let i = 0; i < 3; i += 1) {
    await page.locator(".action-palette").getByLabel("Move", { exact: true }).click();
    await page.locator(".action-palette").getByLabel("Turn", { exact: true }).click();
  }
}

test.describe("contextual repeat suggestion", () => {
  test("no suggestion appears for a non-repetitive program", async ({ page }) => {
    await page.goto("/");
    await page.locator(".action-palette").getByLabel("Move", { exact: true }).click();
    await page.locator(".action-palette").getByLabel("Turn", { exact: true }).click();
    await expect(page.getByTestId("repeat-suggestion")).toHaveCount(0);
  });

  test("reject leaves the canonical program unchanged and stays quiet", async ({ page }) => {
    await buildRepetitiveProgram(page);
    const before = await canonicalHash(page);
    await expect(page.getByTestId("repeat-suggestion")).toBeVisible();
    await page.getByRole("button", { name: "Try it" }).click();
    await expect(page.getByTestId("proposal-preview")).toBeVisible();
    expect(await canonicalHash(page)).toBe(before);
    await page
      .getByTestId("repeat-suggestion")
      .getByRole("button", { name: /Reject/ })
      .click();
    expect(await canonicalHash(page)).toBe(before);
    await expect(page.getByTestId("repeat-suggestion")).toHaveCount(0);
  });

  test("declining with No thanks keeps the program and hides the offer", async ({ page }) => {
    await buildRepetitiveProgram(page);
    const before = await canonicalHash(page);
    await page.getByRole("button", { name: "No thanks" }).click();
    await expect(page.getByTestId("repeat-suggestion")).toHaveCount(0);
    expect(await canonicalHash(page)).toBe(before);
  });

  test("System-0 goes quiet after the learner declines twice", async ({ page }) => {
    await buildRepetitiveProgram(page);
    const suggestion = page.getByTestId("repeat-suggestion");
    await expect(suggestion).toHaveAttribute("data-decision", "offer");
    await page.getByRole("button", { name: "No thanks" }).click();
    await page.locator(".action-palette").getByLabel("Move", { exact: true }).click();
    await expect(suggestion).toBeVisible();
    await page.getByRole("button", { name: "No thanks" }).click();
    await page.locator(".action-palette").getByLabel("Move", { exact: true }).click();
    await expect(suggestion).toHaveCount(0);
  });

  test("accept mutates the canonical program into a repeat and still runs", async ({ page }) => {
    await buildRepetitiveProgram(page);
    const before = await canonicalHash(page);
    await page.getByRole("button", { name: "Try it" }).click();
    await page
      .getByTestId("repeat-suggestion")
      .getByRole("button", { name: /Accept/ })
      .click();
    expect(await canonicalHash(page)).not.toBe(before);
    await expect(page.locator(".code-surface")).toContainText("repeat");
    await page.getByRole("button", { name: "Run", exact: true }).click();
    await expect(page.locator(".run-state")).toBeVisible();
  });
});

test("Step card advances with Next and shows learner-facing evidence", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("step-card")).toHaveCount(0);
  await page.locator(".action-palette").getByLabel("Move", { exact: true }).click();
  await page.getByRole("button", { name: "Step", exact: true }).click();
  const card = page.getByTestId("step-card");
  await expect(card).toContainText("Step 1 of");
  await card.getByRole("button", { name: "Next" }).click();
  await expect(card).toContainText("Step 2 of");
  await expect(card).toContainText("Before:");
});

test("debugging journey: wrong program, runtime evidence, hint, correction, success", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".action-palette").getByLabel("Move", { exact: true }).click();
  const canonicalBefore = await canonicalHash(page);

  // Runtime, not AI language, shows the program is wrong.
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("stopped short")).toBeVisible({ timeout: 5000 });
  await expect(page.getByLabel("Runtime result — actually happened").first()).toBeVisible();

  // A hint explains without changing the program.
  await page.getByRole("button", { name: "Get hint" }).click();
  await expect(page.getByText("Hint level 1 of 5")).toBeVisible();
  expect(await canonicalHash(page)).toBe(canonicalBefore);

  // Learner corrects it and the runtime proves the fix.
  await applyMoveSteps(page, "160");
  expect(await canonicalHash(page)).not.toBe(canonicalBefore);
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("Mission complete: your sprite reached the goal.")).toBeVisible({
    timeout: 5000,
  });
});
