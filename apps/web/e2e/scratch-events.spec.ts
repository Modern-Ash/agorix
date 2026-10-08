import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

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

test("new projects start with a visible green-flag hat and the code says so", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "When green flag clicked" })).toBeVisible();
  await page.getByRole("button", { name: "Move", exact: true }).first().click();
  await expect(page.locator(".code-surface")).toContainText("whenGreenFlagClicked");
  await expect(page.locator(".code-surface")).not.toContainText("whenStarted");
});

test("pressing the flag runs the green-flag script", async ({ page }) => {
  await page.getByRole("button", { name: "Move", exact: true }).first().click();
  const sprite = page.getByTestId("stage-sprite");
  const startX = await sprite.getAttribute("data-x");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect.poll(() => sprite.getAttribute("data-x")).not.toBe(startX);
});

test("a project saved with the old 'When you press Run' hat opens as a green-flag script", async ({
  page,
}) => {
  const legacy = resolve(
    import.meta.dirname,
    "../../../packages/persistence/fixtures/v1/minimal.agorix.json",
  );
  await page.getByLabel("Import Agorix project file").setInputFiles(legacy);
  await expect(page.getByRole("heading", { name: "When green flag clicked" })).toBeVisible();
  await expect(page.locator(".code-surface")).toContainText("whenGreenFlagClicked");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByTestId("stage-feedback")).not.toContainText("could not run");
});
