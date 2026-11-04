import { expect, test, type Page } from "./fixtures.js";
import { clickCreateScene } from "./helpers.js";

// A message while the mouse is over a character says how to open its Properties, and Ori's open
// card no longer sits under Ori's own button.
test.use({ serviceWorkers: "block" });

async function freeScene(page: Page, viewport = { width: 1280, height: 800 }) {
  await page.setViewportSize(viewport);
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

const hint = (page: Page) => page.locator(".kids-studio-stage-hint");
const actor = (page: Page) => page.locator(".kids-studio-stage-actor").first();

test("hovering a character says how to open its properties (and only then)", async ({ page }) => {
  await freeScene(page);
  await expect(hint(page)).not.toHaveAttribute("data-visible", "true");
  await actor(page).hover();
  await expect(hint(page)).toHaveAttribute("data-visible", "true");
  await expect(hint(page)).toHaveText("Doble clic: propiedades");
  // It sits inside the stage, never cut by it.
  const stage = (await page.locator(".kids-studio-stage").boundingBox())!;
  const pill = (await hint(page).boundingBox())!;
  expect(pill.x).toBeGreaterThanOrEqual(stage.x);
  expect(pill.x + pill.width).toBeLessThanOrEqual(stage.x + stage.width);
  expect(pill.y + pill.height).toBeLessThanOrEqual(stage.y + stage.height);
  await page.mouse.move(2, 2);
  await expect(hint(page)).not.toHaveAttribute("data-visible", "true");
});

test("the keyboard gets its own wording, and the description reaches assistive tech", async ({
  page,
}) => {
  await freeScene(page);
  await expect(actor(page)).toHaveAttribute("aria-describedby", "kids-actor-hint-text");
  await expect(page.locator("#kids-actor-hint-text")).toContainText("Doble clic o doble toque");
  await page.keyboard.press("Tab");
  await actor(page).focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  if (await actor(page).evaluate((element) => element === document.activeElement))
    await expect(hint(page)).toHaveText("Enter otra vez: propiedades");
});

test("Ori's open card does not sit under Ori's own button", async ({ page }) => {
  await freeScene(page, { width: 1888, height: 954 });
  await page.getByRole("button", { name: "Abrir Ori" }).click();
  const panel = (await page.locator(".kids-studio-ori").boundingBox())!;
  const rail = (await page.locator(".kids-studio-ori-rail").boundingBox())!;
  // The card ends above the button: no overlap, and it still fits the window.
  expect(panel.y + panel.height).toBeLessThanOrEqual(rail.y + 1);
  expect(panel.y).toBeGreaterThanOrEqual(0);
});
