import { expect, test, type Page } from "@playwright/test";
import { BLOCKS_UNLOCKED, reloadToMap } from "./helpers.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

// Issue #611: what a mission offers follows the mission and what the runtime has shown.
async function open(page: Page, options: { done?: object; mastery?: boolean; mission: string }) {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/kids");
  await page.evaluate(
    ([done, mastery]) => {
      localStorage.clear();
      localStorage.setItem("agorix.locale", "es");
      localStorage.setItem(
        "agorix.kids.progress.v1",
        JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: JSON.parse(done!) }),
      );
      if (mastery) localStorage.setItem("agorix.kids.mastery.v1", mastery);
    },
    [JSON.stringify(options.done ?? {}), options.mastery ? BLOCKS_UNLOCKED : ""],
  );
  await reloadToMap(page);
  await page.getByRole("button", { name: options.mission }).click();
}

const palette = (page: Page) => page.locator(".kids-palette-block");

test("a new child starts the first mission with moving and sound only", async ({ page }) => {
  await open(page, { mission: "Misión 1" });
  await expect(palette(page)).toHaveText(["+ mover", "+ sonar"]);
});

test("turns arrive with the second mission and repeat with the third", async ({ page }) => {
  await open(page, { done: { "space:0": true }, mission: "Misión 2" });
  await expect(palette(page)).toHaveText(["+ mover", "+ girar ←", "+ girar →", "+ sonar"]);
  await page.goto("/kids");
  await open(page, { done: { "space:0": true, "space:1": true }, mission: "Misión 3" });
  await expect(palette(page)).toHaveCount(5);
});

test("a child who has already run programs alone sees every block from the first mission", async ({
  page,
}) => {
  await open(page, { mastery: true, mission: "Misión 1" });
  await expect(palette(page)).toHaveCount(5);
});

test("a child who shows the concepts alone misses one run before the idea hint", async ({
  page,
}) => {
  await open(page, { mastery: true, mission: "Misión 1" });
  for (const level of [1, 2, 3, 4]) {
    await page.getByRole("button", { name: `Pista ${level}`, exact: true }).click();
  }
  const idea = page.getByRole("button", { name: "Ver idea" });
  await expect(idea).toBeDisabled();
  await expect(page.getByText("probá tu programa una vez más")).toBeVisible();
  // One run that misses the goal opens it.
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  await page.getByRole("combobox", { name: "mover 1" }).selectOption("2");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "No sé" }).click();
  await expect(idea).toBeEnabled();
});

test("a beginner is never locked out of the idea hint", async ({ page }) => {
  await open(page, { mission: "Misión 1" });
  for (const level of [1, 2, 3, 4]) {
    await page.getByRole("button", { name: `Pista ${level}`, exact: true }).click();
  }
  await expect(page.getByRole("button", { name: "Ver idea" })).toBeEnabled();
});
