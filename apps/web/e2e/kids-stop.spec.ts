import { expect, test } from "@playwright/test";
import { reloadTo } from "./helpers.js";

test.use({ hasTouch: true });

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 820, height: 1180 },
  { width: 390, height: 844 },
]) {
  test(`a clean free scene can stop and reopen at ${viewport.width}px`, async ({ page }) => {
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
    await page.getByRole("button", { name: "Crear escena" }).click();
    await page.getByRole("combobox", { name: "Detener" }).selectOption("scene");
    await page.getByRole("button", { name: "+ Detener", exact: true }).click();
    await expect(page.locator(".kids-program-block")).toContainText("Detener: toda la escena");
    await page.getByRole("button", { name: "Jugar", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Programa detenido: toda la escena");
    await reloadTo(page, "#/proyectos");
    await page.getByRole("button", { name: "Mis proyectos" }).click();
    await page
      .getByRole("article")
      .filter({ hasText: "Escena libre" })
      .getByRole("button", { name: "Jugar" })
      .click();
    await expect(page.locator(".kids-program-block")).toContainText("Detener: toda la escena");
  });
}
