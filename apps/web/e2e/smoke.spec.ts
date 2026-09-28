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

async function runTransparencyJourney(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.goto("/");

  await page.getByRole("button", { name: "Move" }).click();
  await applyMoveSteps(page, "24");
  await expect(visibleCode(page, "sprite.move(24);")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Code", exact: true })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Code", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByText("Mission complete: your sprite reached the goal.")).toBeVisible({
    timeout: 5000,
  });
}

test("main editor shell renders persistent blocks, stage and code", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Build with blocks. See the code." }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Action palette", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "When you press Run" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stage" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Code", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run" })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Código", exact: true })).toBeVisible();
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

  await expect(page.getByRole("heading", { name: "Trace" })).toBeVisible();
  const movementTrace = page.locator(".trace-item", { hasText: "Nova moved right; x: 52 -> 76" });
  await expect(movementTrace).toBeVisible();
  await expect(movementTrace).toContainText("Before: x 52, y 128, heading 0");
  await expect(movementTrace).toContainText("After: x 76, y 128, heading 0");
  await expect(page.getByText(/provider|prompt|stack/i)).toHaveCount(0);
});

test("transparency journey preserves visible code and explicit proposal control on desktop", async ({
  page,
}) => {
  await runTransparencyJourney(page, { width: 1280, height: 900 });
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

test("tablet landscape keeps World and Code primary without a left toolbox rail", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");

  const world = page.getByRole("heading", { name: "Stage" });
  const code = page.getByRole("heading", { name: "Code", exact: true });
  const palette = page.getByRole("heading", { name: "Action palette", exact: true });

  await expect(world).toBeInViewport();
  await expect(code).toBeInViewport();
  await expect(palette).toBeVisible();
  await expect(page.getByRole("heading", { name: "Blocks", exact: true })).toHaveCount(0);

  const stageBox = await page.locator(".stage-panel").boundingBox();
  const codeBox = await page.locator(".code-panel").boundingBox();
  const paletteBox = await page.locator(".action-palette").boundingBox();
  expect(stageBox).not.toBeNull();
  expect(codeBox).not.toBeNull();
  expect(paletteBox).not.toBeNull();
  expect(stageBox!.width).toBeGreaterThan(360);
  expect(codeBox!.width).toBeGreaterThan(300);
  expect(paletteBox!.x).toBeGreaterThan(stageBox!.x);
});

test("tablet portrait shows World before inspectable Code in normal flow", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Stage" })).toBeInViewport();
  await expect(page.getByRole("heading", { name: "Code", exact: true })).toBeInViewport();

  const stageBox = await page.locator(".stage-panel").boundingBox();
  const codeBox = await page.locator(".code-panel").boundingBox();
  expect(stageBox).not.toBeNull();
  expect(codeBox).not.toBeNull();
  expect(stageBox!.y).toBeLessThan(codeBox!.y);
  await expect(page.locator(".code-surface")).toBeVisible();
});

test("tablet controls meet touch target guidance", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/");

  for (const name of ["Run", "Step", "Stop", "Reset"]) {
    const box = await page.getByRole("button", { name }).boundingBox();
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
  await expect(page.getByRole("heading", { name: "Code", exact: true })).toBeInViewport();
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
