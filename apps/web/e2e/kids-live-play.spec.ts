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

test("moves slide and turns rotate on stage while Play runs", async ({ page }) => {
  await openScene(page);
  for (let i = 0; i < 6; i++)
    await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
  const actor = page.locator(".kids-studio-stage-actor").first();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect
    .poll(() => actor.evaluate((node) => (node as HTMLElement).style.transition))
    .toContain("left");
  // The turn ends the script: the character is left rotated 90 degrees.
  await expect
    .poll(() =>
      actor
        .locator(".kids-studio-stage-costume")
        .evaluate((node) => (node as HTMLElement).style.transform),
    )
    .toContain("rotate(90deg)");
});

test("Replay watches the last run again and ends where it ended", async ({ page }) => {
  await openScene(page);
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  const actor = page.locator(".kids-studio-stage-actor").first();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  const replay = page.locator(".kids-replay-button");
  await expect(replay).toBeEnabled();
  const left = await actor.evaluate((node) => (node as HTMLElement).style.left);
  expect(left).not.toBe("8%");
  await replay.click();
  await expect(replay).toBeEnabled();
  await expect.poll(() => actor.evaluate((node) => (node as HTMLElement).style.left)).toBe(left);
});
