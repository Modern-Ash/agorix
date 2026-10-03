import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    localStorage.clear();
    for (const registration of await navigator.serviceWorker.getRegistrations()) {
      await registration.unregister();
    }
    for (const key of await caches.keys()) {
      await caches.delete(key);
    }
  });
  await page.reload();
});

const palette = (page: Page) => page.locator(".action-palette");

async function canonicalHash(page: Page) {
  return page.getByTestId("canonical-hash").getAttribute("data-canonical-hash");
}

function blockFaces(page: Page) {
  return page.locator(".block-stack .block-face");
}

async function blockOrder(page: Page) {
  return blockFaces(page).allInnerTexts();
}

async function expectMissionComplete(page: Page) {
  await expect(page.getByText("Mission complete: your sprite reached the goal.")).toBeVisible({
    timeout: 5000,
  });
}

test.describe("touch-only First Mission", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 820, height: 1180 } });

  test("completes with taps only, across an orientation change", async ({ page }) => {
    await palette(page).getByRole("button", { name: "Move", exact: true }).tap();
    const input = page.getByLabel("Move block").getByRole("spinbutton");
    await input.tap();
    await input.fill("160");
    await input.press("Enter");
    await expect(page.locator(".code-surface")).toContainText("sprite.move(160);");
    const portraitHash = await canonicalHash(page);

    await page.setViewportSize({ width: 1180, height: 820 });
    await expect(page.getByLabel("Move block").getByRole("spinbutton")).toHaveValue("160");
    expect(await canonicalHash(page)).toBe(portraitHash);

    await page.setViewportSize({ width: 820, height: 1180 });
    expect(await canonicalHash(page)).toBe(portraitHash);

    await page.getByRole("button", { name: "Run", exact: true }).tap();
    await expectMissionComplete(page);
  });

  test("every block action is a 44px tap target and works by touch", async ({ page }) => {
    await palette(page).getByRole("button", { name: "Move", exact: true }).tap();
    await palette(page).getByRole("button", { name: "Turn", exact: true }).tap();

    const actions = page.locator(".block-actions").first();
    for (const name of ["Down", "Duplicate", "Delete"]) {
      const box = await actions.getByRole("button", { name, exact: true }).boundingBox();
      expect(box, name).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    await actions.getByRole("button", { name: "Down", exact: true }).tap();
    expect(await blockOrder(page)).toEqual(["Turn", "Move"]);
    await page.locator(".block-actions").first().getByRole("button", { name: "Duplicate" }).tap();
    await expect(blockFaces(page)).toHaveCount(3);
    await page.locator(".block-actions").first().getByRole("button", { name: "Delete" }).tap();
    await expect(blockFaces(page)).toHaveCount(2);
  });

  test("numeric commit stays visible with a narrow viewport (virtual keyboard)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 420 });
    await palette(page).getByRole("button", { name: "Move", exact: true }).tap();
    const input = page.getByLabel("Move block").getByRole("spinbutton");
    await input.tap();
    await expect(input).toBeInViewport();
    await expect(page.getByLabel("Move block")).toBeInViewport();
  });
});

test.describe("keyboard-only First Mission", () => {
  test("completes with keyboard only, no pointer or drag", async ({ page }) => {
    const move = palette(page).getByRole("button", { name: "Move", exact: true });
    await move.focus();
    await page.keyboard.press("Enter");
    // Focus follows the new block.
    await expect(blockFaces(page).first()).toBeFocused();
    await expect(page.getByTestId("editor-announcer")).toContainText(
      "Move added at position 1 of 1.",
    );

    await page.getByLabel("Move block").getByRole("spinbutton").focus();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("160");
    await page.keyboard.press("Enter");
    await expect(page.locator(".code-surface")).toContainText("sprite.move(160);");

    await page.getByRole("button", { name: "Run", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expectMissionComplete(page);
  });

  test("reorder, duplicate, nest, outdent and delete work with shortcuts and announce", async ({
    page,
  }) => {
    const announcer = page.getByTestId("editor-announcer");
    await palette(page).getByRole("button", { name: "Move", exact: true }).click();
    await palette(page).getByRole("button", { name: "Turn", exact: true }).click();
    await palette(page)
      .getByRole("button", { name: /Repeat/ })
      .first()
      .click();
    expect(await blockOrder(page)).toEqual(["Move", "Turn", "Repeat"]);

    // Reorder: Alt+ArrowDown on Move.
    await blockFaces(page).first().focus();
    await page.keyboard.press("Alt+ArrowDown");
    expect(await blockOrder(page)).toEqual(["Turn", "Move", "Repeat"]);
    await expect(announcer).toContainText("Move moved to position 2 of 3.");
    await expect(blockFaces(page).nth(1)).toBeFocused();

    // Arrow keys move focus between blocks without changing anything.
    const hash = await canonicalHash(page);
    await page.keyboard.press("ArrowDown");
    await expect(blockFaces(page).nth(2)).toBeFocused();
    expect(await canonicalHash(page)).toBe(hash);

    // Nest Move into... Repeat precedes only when it is the previous sibling.
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Alt+ArrowDown");
    expect(await blockOrder(page)).toEqual(["Turn", "Repeat", "Move"]);
    await page.keyboard.press("Alt+ArrowRight");
    await expect(announcer).toContainText("Move nested inside Repeat");
    await expect(page.locator('[data-statement-path="1.0"]')).toBeVisible();
    await expect(
      page.locator('[data-statement-path="1.0"] > .scratch-block-main .block-face'),
    ).toBeFocused();
    await expect(page.locator('[data-statement-path="1.0"]')).toContainText(
      "Position 1 of 1, nesting level 2.",
    );

    await page.keyboard.press("Alt+ArrowLeft");
    await expect(announcer).toContainText("Move moved out of Repeat");
    expect(await blockOrder(page)).toEqual(["Turn", "Repeat", "Move"]);

    // Duplicate with Ctrl+D, then delete with Delete; focus lands on a neighbour.
    await page.keyboard.press("Control+d");
    await expect(blockFaces(page)).toHaveCount(4);
    await expect(announcer).toContainText("duplicated");
    await page.keyboard.press("Delete");
    await expect(blockFaces(page)).toHaveCount(3);
    await expect(announcer).toContainText("Move deleted. 3 blocks left.");
    await expect(blockFaces(page).nth(2)).toBeFocused();
  });

  test("deleting the last block returns focus to the palette", async ({ page }) => {
    await palette(page).getByRole("button", { name: "Move", exact: true }).click();
    await blockFaces(page).first().focus();
    await page.keyboard.press("Delete");
    await expect(blockFaces(page)).toHaveCount(0);
    await expect(palette(page).locator("button:focus")).toHaveCount(1);
  });

  test("blocks expose position and shortcut semantics to assistive tech", async ({ page }) => {
    await palette(page).getByRole("button", { name: "Move", exact: true }).click();
    await palette(page).getByRole("button", { name: "Turn", exact: true }).click();
    const turnFace = blockFaces(page).nth(1);
    await expect(turnFace).toHaveAccessibleDescription(
      /Position 2 of 2, nesting level 1\..*Keyboard:/,
    );
    await expect(page.getByTestId("editor-announcer")).toHaveAttribute("role", "status");
  });
});

test.describe("input method and orientation parity", () => {
  test("pointer, touch and keyboard produce the same canonical program", async ({ page }) => {
    // Pointer path.
    await palette(page).getByRole("button", { name: "Move", exact: true }).click();
    await palette(page).getByRole("button", { name: "Turn", exact: true }).click();
    await page.locator(".block-actions").first().getByRole("button", { name: "Down" }).click();
    const pointerHash = await canonicalHash(page);

    // Keyboard path on a fresh project.
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await palette(page).getByRole("button", { name: "Move", exact: true }).focus();
    await page.keyboard.press("Enter");
    await palette(page).getByRole("button", { name: "Turn", exact: true }).focus();
    await page.keyboard.press("Enter");
    await blockFaces(page).first().focus();
    await page.keyboard.press("Alt+ArrowDown");
    expect(await canonicalHash(page)).toBe(pointerHash);

    // Orientation does not drift the canonical program.
    for (const viewport of [
      { width: 820, height: 1180 },
      { width: 1180, height: 820 },
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      expect(await canonicalHash(page)).toBe(pointerHash);
      expect(await blockOrder(page)).toEqual(["Turn", "Move"]);
    }
  });

  test("reduced motion removes block control transitions", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await palette(page).getByRole("button", { name: "Move", exact: true }).click();
    const duration = await page
      .locator(".block-actions")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    for (const part of duration.split(",")) {
      expect(parseFloat(part)).toBeLessThan(0.01);
    }
  });

  test("block actions are visible without hover", async ({ page }) => {
    await palette(page).getByRole("button", { name: "Move", exact: true }).click();
    await page.mouse.move(0, 0);
    const opacity = await page
      .locator(".block-actions")
      .first()
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(Number(opacity)).toBeGreaterThanOrEqual(0.7);
  });
});
