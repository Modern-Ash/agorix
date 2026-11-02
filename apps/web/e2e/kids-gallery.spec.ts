import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures.js";
import { reloadTo } from "./helpers.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

test("a new child can browse included art, create a project and reopen it", async ({ page }) => {
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
  expect(await page.evaluate(() => localStorage.getItem("agorix.kids.flags.v1"))).toBeNull();
  await page.getByRole("button", { name: "Crear", exact: true }).click();

  await page.getByRole("searchbox", { name: "Buscar personaje" }).fill("nov");
  await expect(page.getByRole("button", { name: "Nova", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mika", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Nova", exact: true }).click();
  await page.getByRole("button", { name: /^2 ·/ }).click();
  await page
    .getByRole("group", { name: "Categorías de fondos" })
    .getByRole("button", { name: "Naturaleza" })
    .click();
  await page.getByRole("button", { name: "Bosque", exact: true }).click();
  await expect(page.getByRole("button", { name: "Bosque", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: /^1 ·/ }).click();
  await expect(page.getByRole("button", { name: "Nova", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await expect(page.getByRole("group", { name: "Tu elección" })).toContainText("Nova");
  await expect(page.getByRole("group", { name: "Tu elección" })).toContainText("Bosque");

  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);

  await page.getByRole("button", { name: "Crear escena" }).click();
  await expect(page.getByRole("group", { name: "Escenario" })).toHaveClass(/kids-art-backdrop/);
  await reloadTo(page, "#/proyectos");
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await expect(page.locator(".kids-project-card .kids-art-backdrop")).toBeVisible();
  await page.locator(".kids-project-card").getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByRole("group", { name: "Escenario" })).toHaveClass(/kids-art-backdrop/);
});
