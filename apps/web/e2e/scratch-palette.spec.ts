import { expect, test } from "@playwright/test";

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

test("the palette groups blocks by Scratch category and hides unsupported ones", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const palette = page.locator(".action-palette");
  for (const [category, block] of [
    ["Motion", "Set x"],
    ["Motion", "Set y"],
    ["Control", "Wait"],
  ] as const) {
    const group = palette.locator(".scratch-category", {
      has: page.getByRole("heading", { name: category, exact: true }),
    });
    await expect(group.getByRole("button", { name: block, exact: true })).toBeVisible();
  }
  await expect(palette.getByRole("button", { name: "Go to x/y" })).toHaveCount(0);
});

test("a new block is click-added, projected to code and runs on the stage", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: "Set x", exact: true }).click();
  await page.getByRole("button", { name: "Wait", exact: true }).click();
  await expect(page.locator(".code-surface")).toContainText("sprite.setX(0);");
  await expect(page.locator(".code-surface")).toContainText("wait(1);");
  await page.getByRole("button", { name: "Run", exact: true }).first().click();
  await expect(page.getByTestId("stage-sprite")).toHaveAttribute("data-x", "0");
});

test("Looks blocks change the sprite on the stage", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const looks = page.locator(".scratch-category", {
    has: page.getByRole("heading", { name: "Looks", exact: true }),
  });
  await looks.getByRole("button", { name: "Set size", exact: true }).click();
  await looks.getByRole("button", { name: "Say", exact: true }).click();
  await expect(page.locator(".code-surface")).toContainText("sprite.setSize(100);");
  await expect(page.locator(".code-surface")).toContainText('sprite.say("Hello!", 2);');
  await page.getByRole("button", { name: "Run", exact: true }).first().click();
  await expect(page.getByTestId("stage-say")).toHaveText("Hello!");
  await looks.getByRole("button", { name: "Hide", exact: true }).click();
  await page.getByRole("button", { name: "Run", exact: true }).first().click();
  await expect(page.getByTestId("stage-sprite")).toHaveAttribute("data-visible", "false");
});
