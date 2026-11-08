import { expect, test, type Page } from "./fixtures.js";
import { clickCreateScene } from "./helpers.js";

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

test.use({ hasTouch: true, serviceWorkers: "block" });

test("Play shows the run live and Stop ends it where it is", async ({ page }) => {
  await openScene(page);
  for (let i = 0; i < 6; i++)
    await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  const step = page.getByRole("button", { name: "Paso", exact: true });
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  // While playing, the run is stepping through frames: Step is enabled before the end.
  await expect(step).toBeEnabled();
  // Stop clears the run immediately.
  await page.locator(".kids-stop-button").click();
  await expect(step).toBeDisabled();
});
