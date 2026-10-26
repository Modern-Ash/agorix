import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.use({ hasTouch: true, serviceWorkers: "block" });

// Issue #594: one selection in Crear, remembered, and Escena libre starts from it.
test("the character picked in Crear is remembered and starts the scene", async ({ page }) => {
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
  // Nothing from the gallery chosen yet: the scene says what it will start with.
  await expect(page.getByTestId("studio-start-note")).toContainText(
    "Elegí un personaje de la galería",
  );
  await page.getByRole("button", { name: "Luma", exact: true }).click();
  await expect(page.getByRole("button", { name: "Luma", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("studio-start-note")).toContainText("La escena empieza con Luma.");
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);

  // Leaving and coming back, even after a reload, keeps the choice.
  await page.getByRole("button", { name: "Mapa" }).click();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await expect(page.getByRole("button", { name: "Luma", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.reload();
  await expect(page.getByRole("button", { name: "Luma", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: "Crear escena" }).click();
  await expect(
    page.getByRole("group", { name: "Personajes" }).getByRole("button").first(),
  ).toContainText("Luma");
});
