import { expect, test } from "@playwright/test";
import { reloadTo } from "./helpers.js";

test.use({ hasTouch: true });

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 820, height: 1180 },
  { width: 390, height: 844 },
]) {
  test(`wait until has a bounded result and reopens at ${viewport.width}px`, async ({ page }) => {
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
    await page.getByTestId("compound-wait-until").click();
    await expect(page.locator(".kids-program-block")).toContainText("Esperar hasta");
    await page.getByRole("button", { name: "Jugar", exact: true }).click();
    await expect(page.getByText(/la condición no se cumplió en 10 segundos/i)).toBeVisible();
    await reloadTo(page, "#/proyectos");
    await page.getByRole("button", { name: "Mis proyectos" }).click();
    await page
      .getByRole("article")
      .filter({ hasText: "Escena libre" })
      .getByRole("button", { name: "Jugar" })
      .click();
    await expect(page.locator(".kids-program-block")).toContainText("Esperar hasta");
  });
}
