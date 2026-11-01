import { expect, test } from "./fixtures.js";
import { reloadTo } from "./helpers.js";

test.use({ hasTouch: true });

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 820, height: 1180 },
  { width: 390, height: 844 },
]) {
  test(`Ori explains a compound condition and keeps review explicit at ${viewport.width}px`, async ({
    page,
  }) => {
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
    const conditions = page.getByRole("group", { name: "Combinar condiciones" });
    const ask = conditions.getByRole("button", { name: "Pedirle a Ori una combinación" });
    await ask.click();
    const proposal = page.getByTestId("ori-compound-proposal");
    await expect(proposal).toContainText("solo si se pulsa Espacio");
    await expect(proposal).toContainText("todavía no está en tu programa");
    await expect(page.locator(".kids-program-block")).toHaveCount(0);
    await proposal.getByRole("button", { name: "No usar" }).click();
    await expect(proposal).toHaveCount(0);
    await expect(page.locator(".kids-program-block")).toHaveCount(0);

    await ask.click();
    await proposal.getByRole("button", { name: "Cambiar idea" }).click();
    await expect(page.locator(".kids-program-block")).toHaveCount(1);
    await expect(page.locator(".kids-program-block")).toContainText("o");
    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect(page.locator(".kids-program-block")).toHaveCount(0);
    await page.getByRole("button", { name: "Rehacer" }).click();
    await expect(page.locator(".kids-program-block")).toHaveCount(1);

    await reloadTo(page, "#/proyectos");
    await page.getByRole("button", { name: "Mis proyectos" }).click();
    await page
      .getByRole("article")
      .filter({ hasText: "Escena libre" })
      .getByRole("button", { name: "Jugar" })
      .click();
    await expect(page.locator(".kids-program-block")).toHaveCount(1);
  });
}
