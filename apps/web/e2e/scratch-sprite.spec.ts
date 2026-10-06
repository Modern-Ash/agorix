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

test("a learner selects the sprite, edits its properties and the stage follows", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByTestId("actor-chip")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("actor-name").fill("Cat");
  await expect(page.getByTestId("actor-chip")).toContainText("Cat");
  await page.getByTestId("actor-x").fill("120");
  await page.getByTestId("actor-direction").fill("90");
  const sprite = page.getByTestId("stage-sprite");
  await expect(sprite).toHaveAttribute("data-x", "120");
  await expect(sprite).toHaveAttribute("data-heading", "90");
  await page.getByTestId("actor-size").fill("200");
  await expect(sprite).toHaveAttribute("data-size", "200");
  await page.getByTestId("actor-visible").uncheck();
  await expect(sprite).toHaveAttribute("data-visible", "false");
});

test("actor edits survive a reload", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByTestId("actor-name").fill("Dino");
  await page.getByTestId("actor-y").fill("40");
  await page.getByRole("button", { name: "Move", exact: true }).first().click();
  await page.reload();
  await expect(page.getByTestId("actor-chip")).toContainText("Dino");
  await expect(page.getByTestId("actor-y")).toHaveValue("40");
});

test("a learner picks a sprite look and a backdrop from the offline library", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.context().setOffline(true);
  await page.getByTestId("actor-costume").selectOption("cat");
  await page.getByTestId("stage-backdrop").selectOption("space");
  await expect(page.locator(".stage-canvas text.world-glyph").last()).toHaveText("🐱");
  await expect(page.locator("rect.backdrop-space")).toHaveCount(1);
  await page.getByRole("button", { name: "Move", exact: true }).first().click();
  await page.context().setOffline(false);
  await page.reload();
  await expect(page.getByTestId("actor-costume")).toHaveValue("cat");
  await expect(page.getByTestId("stage-backdrop")).toHaveValue("space");
});
