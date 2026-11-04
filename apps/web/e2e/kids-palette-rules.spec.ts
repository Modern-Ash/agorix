import { expect, test, type Page } from "./fixtures.js";
import { clickCreateScene } from "./helpers.js";

// Issue #1235: a block that means nothing yet stays in the palette, dimmed, with the reason.
test.use({ serviceWorkers: "block" });

async function freeScene(page: Page) {
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
  await clickCreateScene(page);
}

const blocks = (page: Page) => page.locator(".kids-program-block");

test("Stop sounds is dimmed until a sound is in the project, and says why (#1235)", async ({
  page,
}) => {
  await freeScene(page);
  const stop = page.getByRole("button", { name: "+ Detener sonidos", exact: true });
  await expect(stop).toBeVisible(); // still in the palette: the catalog stays whole
  await expect(stop).toHaveAttribute("aria-disabled", "true");
  await expect(stop).toHaveAttribute("title", /Primero poné un bloque de sonido/);
  // Playwright treats aria-disabled as not clickable; a child's tap still reaches it.
  await stop.click({ force: true });
  await expect(blocks(page)).toHaveCount(0);
  await expect(page.locator(".kids-palette-hint")).toContainText(
    "Primero poné un bloque de sonido",
  );

  // Once a sound is in the program it is ready, and adds a block.
  await page.getByRole("button", { name: "+ Sonar", exact: true }).click();
  await expect(stop).not.toHaveAttribute("aria-disabled", "true");
  await stop.click();
  await expect(blocks(page)).toHaveCount(2);
  await expect(blocks(page).last()).toContainText("Detener sonidos");
});

test("layers wait for a second character, and a dimmed block cannot be dragged (#1235)", async ({
  page,
}) => {
  await freeScene(page);
  const front = page.getByRole("button", { name: "+ Pasar al frente", exact: true });
  await expect(front).toHaveAttribute("aria-disabled", "true");
  // A drag from a dimmed block drops nothing.
  const from = (await front.boundingBox())!;
  const to = (await page.locator(".kids-program-drop").boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(blocks(page)).toHaveCount(0);
  await expect(page.locator(".kids-drag-ghost")).toHaveCount(0);

  await page.getByRole("button", { name: "+ Agregar personaje" }).click();
  await expect(front).not.toHaveAttribute("aria-disabled", "true");
});

test("a project that already uses a dependent block keeps working (#1235)", async ({ page }) => {
  await freeScene(page);
  await page.getByRole("button", { name: "+ Sonar", exact: true }).click();
  await page.getByRole("button", { name: "+ Detener sonidos", exact: true }).click();
  // Take the sound away: the stop block already in the program stays and still runs.
  await page.getByRole("button", { name: "Quitar bloque 1" }).click();
  await expect(blocks(page)).toHaveCount(1);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("1 bloque ejecutado")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "+ Detener sonidos", exact: true }),
  ).toHaveAttribute("aria-disabled", "true");
});
