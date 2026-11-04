import { expect, test } from "./fixtures.js";
import { clickCreateScene } from "./helpers.js";

// Issue #1220: most journeys assert the stage through DOM attributes. This one looks at what the
// child sees: the stage before Play and after it (character moved, costume changed, a second
// character on stage). Snapshots are generated in the CI Playwright image.
test.use({ serviceWorkers: "block" });

test("the stage looks right before Play and after the program ran (#1220)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
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
  await page
    .getByRole("navigation", { name: "Pasos para crear" })
    .getByRole("button", { name: /^2 ·/ })
    .click();
  await page.getByLabel("Fondos incluidos").getByRole("button", { name: "Arrecife" }).click();
  await clickCreateScene(page);
  await expect(page.getByRole("heading", { name: "Escena libre" })).toBeVisible();

  const stage = page.locator(".kids-studio-stage");
  const options = { animations: "disabled", maxDiffPixelRatio: 0.02 } as const;
  await expect(stage).toHaveScreenshot("stage-before-play.png", options);
  const before = await stage.screenshot({ animations: "disabled" });

  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page
    .locator(".kids-studio-palette .kids-palette-tool-looks")
    .filter({ has: page.getByRole("button", { name: "+ Cambiar disfraz", exact: true }) })
    .getByRole("combobox", { name: "Cambiar disfraz" })
    .selectOption("mika");
  await page.getByRole("button", { name: "+ Cambiar disfraz", exact: true }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("3 bloques ejecutados")).toBeVisible();

  await expect(stage).toHaveScreenshot("stage-after-play.png", options);
  // And the two are not the same picture: the run changed what the child sees.
  expect((await stage.screenshot({ animations: "disabled" })).equals(before)).toBe(false);
});
