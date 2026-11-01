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

test("Escena libre opens one colour at a time and closes after adding a block", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seed(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  const rail = page.getByRole("navigation", { name: "Categorías de bloques" });
  const tools = page.locator("[data-kids-palette-tool]:visible");
  const program = page.locator(".kids-studio-program-column");
  const programBefore = await program.boundingBox();

  // The program has the space until the child chooses a colour.
  await expect(page.locator(".kids-studio-palette")).toBeHidden();
  await expect(page.getByRole("button", { name: "+ Decir", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "+ Mover", exact: true })).toBeHidden();

  await rail.getByRole("button", { name: "Apariencia y tiempo" }).click();
  await expect(rail.getByRole("button", { name: "Apariencia y tiempo" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.getByRole("button", { name: "+ Decir", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Mover", exact: true })).toBeHidden();
  expect((await program.boundingBox())?.x).toBe(programBefore?.x);
  const looks = await tools.count();
  expect(looks).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expect(page.locator(".kids-studio-palette")).toBeHidden();
  await expect(rail.getByRole("button", { name: "Apariencia y tiempo" })).toBeFocused();
  await rail.getByRole("button", { name: "Apariencia y tiempo" }).click();

  // Another colour replaces it; the same colour again closes it.
  await rail.getByRole("button", { name: "Movimiento" }).click();
  await expect(page.getByRole("button", { name: "+ Mover", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Decir", exact: true })).toBeHidden();
  await rail.getByRole("button", { name: "Movimiento" }).click();
  await expect(page.getByRole("button", { name: "+ Mover", exact: true })).toBeHidden();
  await expect(page.locator(".kids-studio-palette")).toBeHidden();

  // The tile still adds its block, and its name does not include the picture.
  await rail.getByRole("button", { name: "Movimiento" }).click();
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
  await expect(page.locator(".kids-studio-palette")).toBeHidden();
  await page.reload();
  await expect(page.locator(".kids-studio-palette")).toBeHidden();
  expect(looks).toBeGreaterThan(0);
});

test("an old show-all preference migrates to the contextual palette", async ({ page }) => {
  await seed(page);
  await page.evaluate(() => localStorage.setItem("agorix.kids.palette.view.v1", "all"));
  await page.reload();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  await expect(page.locator(".kids-studio-palette")).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("agorix.kids.palette.view.v1")))
    .toBe("focused");
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

test("on a phone the sheet opens for the chosen colour and closes after adding", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  await expect(page.locator(".kids-studio-palette")).toBeHidden();
  await expect(page.getByRole("button", { name: "+ Decir", exact: true })).toBeHidden();
  await page
    .getByRole("navigation", { name: "Categorías de bloques" })
    .getByRole("button", { name: "Apariencia y tiempo" })
    .click();
  await expect(page.getByRole("button", { name: "+ Decir", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Mover", exact: true })).toBeHidden();
  await page.getByRole("button", { name: "+ Decir", exact: true }).click();
  await expect(page.locator(".kids-studio-palette")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
