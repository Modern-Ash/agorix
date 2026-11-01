// Plain Playwright, not ./fixtures.js: this spec needs the real default and a preference that survives
// a reload.
import { expect, test } from "@playwright/test";

test.use({ hasTouch: true, serviceWorkers: "block" });

// Issue #1110: the block palette opens one colour at a time; the other specs run with "show all".
const PROGRESS = { onboarded: true, avatar: "🐸", stars: 0, done: {} };

async function seed(page: import("@playwright/test").Page) {
  await page.goto("/kids");
  await page.evaluate((progress) => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem("agorix.kids.progress.v1", JSON.stringify(progress));
  }, PROGRESS);
  await page.reload();
}

test("Escena libre shows a few starters, then only the colour the child opens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seed(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  const rail = page.getByRole("navigation", { name: "Categorías de bloques" });
  const tools = page.locator("[data-kids-palette-tool]:visible");

  // Before choosing a colour only the starter shelf shows.
  await expect(page.getByRole("button", { name: /^★ Mover/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Decir", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "+ Mover", exact: true })).toBeHidden();

  await rail.getByRole("button", { name: "Apariencia y tiempo" }).click();
  await expect(rail.getByRole("button", { name: "Apariencia y tiempo" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "+ Decir", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Mover", exact: true })).toBeHidden();
  const looks = await tools.count();
  expect(looks).toBeGreaterThan(0);

  // Another colour replaces it; the same colour again closes it.
  await rail.getByRole("button", { name: "Movimiento" }).click();
  await expect(page.getByRole("button", { name: "+ Mover", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Decir", exact: true })).toBeHidden();
  await rail.getByRole("button", { name: "Movimiento" }).click();
  await expect(page.getByRole("button", { name: "+ Mover", exact: true })).toBeHidden();

  // The tile still adds its block, and its name does not include the picture.
  await rail.getByRole("button", { name: "Movimiento" }).click();
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(1);

  // "Ver todo" lists every family again and is remembered.
  await page.getByRole("button", { name: "Ver todo" }).click();
  await expect(page.getByRole("button", { name: "+ Decir", exact: true })).toBeVisible();
  expect(await tools.count()).toBeGreaterThan(looks);
  await page.reload();
  await expect(page.getByRole("button", { name: "Ver por categoría" })).toBeVisible();
  await page.getByRole("button", { name: "Ver por categoría" }).click();
  await expect(page.getByRole("button", { name: "+ Decir", exact: true })).toBeHidden();
});

test("a mission opens on its first colour, keeps tools above the program and switches colour", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seed(page);
  await page.getByRole("button", { name: "Misión 1" }).click();
  const chips = page.locator(".kids-palette-cats");
  const motion = chips.getByRole("button", { name: "Movimiento" });
  await expect(motion).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "+ mover", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ sonar", exact: true })).toBeHidden();

  // The tools are on screen next to the program, not below the fold.
  const palette = (await page.locator(".kids-palette").boundingBox())!;
  const program = (await page.locator(".kids-program-stack").boundingBox())!;
  expect(palette.y).toBeLessThan(program.y);
  expect(palette.y + palette.height).toBeLessThanOrEqual(900);

  await chips.getByRole("button", { name: "Sonido" }).click();
  await expect(page.getByRole("button", { name: "+ sonar", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ mover", exact: true })).toBeHidden();
  await chips.getByRole("button", { name: "Sonido" }).click();
  await expect(page.locator(".kids-palette-block")).toHaveCount(0);

  await chips.getByRole("button", { name: "Movimiento" }).click();
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
  await page.getByRole("button", { name: "Ver todo" }).click();
  await expect(page.getByRole("button", { name: "+ sonar", exact: true })).toBeVisible();
});

test("on a phone the sheet shows starters, then the colour chosen in the top bar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  await expect(page.getByRole("button", { name: /^★ Mover/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Decir", exact: true })).toBeHidden();
  await page
    .getByRole("navigation", { name: "Categorías de bloques" })
    .getByRole("button", { name: "Apariencia y tiempo" })
    .click();
  await expect(page.getByRole("button", { name: "+ Decir", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ver todo" }).click();
  await expect(page.getByRole("button", { name: "+ Mover", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
