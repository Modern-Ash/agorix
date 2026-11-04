import { expect, test } from "./fixtures.js";
import { clickCreateScene } from "./helpers.js";

// Roll over on a stage character: a ring and a glow for a mouse, nothing for reduced motion's
// transition, and no change to what a tap or a drag does.
test.use({ serviceWorkers: "block" });

async function freeScene(page: import("@playwright/test").Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
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

const actor = (page: import("@playwright/test").Page) =>
  page.locator(".kids-studio-stage-actor").first();

test("a mouse over a stage character lights it, and leaving puts it out", async ({ page }) => {
  await freeScene(page);
  // Not selected yet: deselect by adding a second character and picking it.
  await page.getByRole("button", { name: "+ Agregar personaje" }).click();
  await page.getByRole("group", { name: "Personajes" }).getByRole("button").last().click();
  await expect(actor(page)).toHaveAttribute("aria-pressed", "false");
  const resting = await actor(page).evaluate((el) => getComputedStyle(el).boxShadow);
  expect(resting).toBe("none");
  await actor(page).hover();
  await expect
    .poll(() => actor(page).evaluate((el) => getComputedStyle(el).boxShadow))
    .not.toBe("none");
  await expect(actor(page).locator(".kids-studio-stage-costume")).toHaveCSS(
    "animation-name",
    "kids-actor-hover",
  );
  await page.mouse.move(2, 2);
  await expect
    .poll(() => actor(page).evaluate((el) => getComputedStyle(el).boxShadow))
    .toBe("none");
});

test("with reduced motion the ring still shows but nothing animates", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await freeScene(page);
  await page.getByRole("button", { name: "+ Agregar personaje" }).click();
  await page.getByRole("group", { name: "Personajes" }).getByRole("button").last().click();
  await actor(page).hover();
  await expect
    .poll(() => actor(page).evaluate((el) => getComputedStyle(el).boxShadow))
    .not.toBe("none");
  await expect(actor(page).locator(".kids-studio-stage-costume")).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(actor(page)).toHaveCSS("transition-duration", "0s");
});

test("hovering does not change what a tap does, and the hover never moves the character", async ({
  page,
}) => {
  await freeScene(page);
  const before = await actor(page).getAttribute("style");
  await actor(page).hover();
  expect(await actor(page).getAttribute("style")).toBe(before);
  await actor(page).click();
  await expect(actor(page)).toHaveAttribute("aria-pressed", "true");
});
