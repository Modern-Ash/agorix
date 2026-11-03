import { expect, test } from "./fixtures.js";

async function seed(page: import("@playwright/test").Page) {
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
}

test("a mission opened from the map goes back to the map (#1207)", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Misión 1" }).click();
  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await expect(page.getByRole("heading", { name: "Mapa" })).toBeVisible();
});

test("a scene opened from My projects goes back to My projects (#1207)", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena", exact: true }).click();
  await page.getByRole("button", { name: "Volver a Crear" }).click();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("button", { name: /Jugar|Abrir|Continuar/ })
    .first()
    .click();
  const back = page.getByRole("button", { name: "Volver a Mis proyectos" });
  await expect(back).toBeVisible();
  await back.click();
  await expect(page.getByRole("heading", { name: /Mis proyectos/ })).toBeVisible();
});

test("the grown-ups door and onboarding both have a visible way out (#1207)", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Adultos" }).click();
  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await expect(page.getByRole("heading", { name: "Mapa" })).toBeVisible();
});
