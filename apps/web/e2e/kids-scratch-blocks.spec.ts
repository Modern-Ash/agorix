import { expect, test, type Page } from "./fixtures.js";
import { clickCreateScene } from "./helpers.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

async function openScene(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/kids");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  });
  await page.reload();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await clickCreateScene(page);
}

test("change x and set y move the character without turning it", async ({ page }) => {
  await openScene(page);
  await page.getByRole("button", { name: "+ Cambiar x en", exact: true }).click();
  await page.getByRole("button", { name: "+ Fijar y", exact: true }).click();
  await expect(page.locator(".kids-program-block").first()).toContainText("Cambiar x en 40");
  const actor = page.locator(".kids-studio-stage-actor").first();
  const before = await actor.evaluate((node) => (node as HTMLElement).style.left);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect
    .poll(() => actor.evaluate((node) => (node as HTMLElement).style.left))
    .not.toBe(before);
});

test("say for N seconds shows the bubble and then takes it away", async ({ page }) => {
  await openScene(page);
  await page.getByRole("button", { name: /^\+ Decir por 1 s$/ }).click();
  await expect(page.locator(".kids-program-block").first()).toContainText("(1s)");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  const bubble = page.locator(".kids-studio-bubble");
  await expect(bubble).toBeVisible();
  await expect(bubble).toHaveCount(0, { timeout: 5000 });
});
