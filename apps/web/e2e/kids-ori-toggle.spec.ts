import { expect, test, type Page } from "./fixtures.js";
import { clickCreateScene } from "./helpers.js";

// Issue #1244: Ori hides when it is tapped again; there is no separate "hide help" button.
test.use({ serviceWorkers: "block" });

async function freeScene(page: Page, viewport: { width: number; height: number }) {
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

const open = (page: Page) => page.locator(".kids-studio-ori:not([data-collapsed='true'])");

test("Ori's own button opens it and closes it again on a wide screen (#1244)", async ({ page }) => {
  await freeScene(page, { width: 1280, height: 800 });
  const rail = page.locator(".kids-studio-ori-rail");
  await expect(rail).toHaveAttribute("aria-expanded", "false");
  await rail.click();
  await expect(open(page)).toBeVisible();
  await expect(rail).toHaveAttribute("aria-expanded", "true");
  await expect(rail).toHaveAccessibleName("Cerrar Ori");
  // The old separate button is gone.
  await expect(page.getByRole("button", { name: /Ocultar ayuda de Ori/ })).toHaveCount(0);
  await rail.click();
  await expect(open(page)).toHaveCount(0);
  await expect(rail).toHaveAttribute("aria-expanded", "false");
});

test("tapping Ori's face in the open card hides it, on any screen (#1244)", async ({ page }) => {
  await freeScene(page, { width: 390, height: 844 });
  await page.getByRole("button", { name: "Mostrar ayuda de Ori" }).click();
  await expect(open(page)).toBeVisible();
  await expect(page.getByRole("button", { name: /Ocultar ayuda de Ori/ })).toHaveCount(0);
  await open(page).getByRole("button", { name: "Ocultar Ori" }).click();
  await expect(open(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mostrar ayuda de Ori" })).toBeVisible();
});
