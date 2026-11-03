import { expect, test } from "@playwright/test";
import { clickCreateScene, categoryNav } from "./helpers.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

test("a new phone scene starts with its stage, Play and the program below", async ({ page }) => {
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

  const canvas = page.locator(
    ".kids-studio-program-column .kids-program-zone > .kids-program-stack",
  );
  const stage = page.getByRole("group", { name: "Escenario" });
  const play = page.getByRole("button", { name: "Jugar", exact: true });
  const [canvasBox, stageBox, playBox] = await Promise.all(
    [canvas, stage, play].map((item) => item.boundingBox()),
  );
  expect(playBox!.y).toBeLessThan(stageBox!.y);
  expect(stageBox!.y).toBeLessThan(canvasBox!.y);
  await expect(play).toBeVisible();
  await (await categoryNav(page)).getByRole("button", { name: "Mis bloques" }).click();
  await expect(page.locator('.kids-studio-palette[data-open-cat="myBlocks"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
