import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.use({ hasTouch: true, serviceWorkers: "block" });

test("free scene keeps independent character scripts and reopens the saved stage", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
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
  await expect(page.getByRole("heading", { name: "Escena libre" })).toBeVisible();
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await page.getByRole("button", { name: "+ Mover" }).click();
  await page.getByRole("button", { name: "+ Agregar personaje" }).click();
  await expect(page.getByRole("group", { name: "Personajes" }).getByRole("button")).toHaveCount(2);
  await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
  await page.getByRole("group", { name: "Personajes" }).getByRole("button").first().click();
  await expect(page.locator(".kids-program-block")).toContainText("Mover 1");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("2 bloques ejecutados")).toBeVisible();
  await page.getByRole("button", { name: "Pedirle una idea a Ori" }).click();
  await expect(page.getByText("Ori propone mover este personaje una casilla.")).toBeVisible();
  await page.getByRole("button", { name: "Usar idea" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(2);
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(page.getByRole("group", { name: "Personajes" }).getByRole("button")).toHaveCount(2);
  await expect(page.locator(".kids-program-block")).toContainText("Mover 1");
});
