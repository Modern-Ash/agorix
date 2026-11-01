import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.use({ hasTouch: true, serviceWorkers: "block" });

// Issue #1134: Crear shows the actual scene character and backdrop, remembers both, and starts
// the one creative editor with that selection.
test("the scene character and backdrop stay chosen and start the same scene", async ({ page }) => {
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
  const note = page.getByTestId("studio-start-note");
  await expect(note).toHaveText("La escena empieza con Nova.");
  await expect(page.getByRole("button", { name: /Elegí tu personaje: 🐼|: 🐼$/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Nova", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: "Cometa", exact: true }).click();
  const backdrop = page.getByLabel("Fondos incluidos").getByRole("button", { name: "Arrecife" });
  await backdrop.click();
  await expect(page.getByRole("button", { name: "Cometa", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Nova", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(note).toHaveText("La escena empieza con Cometa.");
  await expect(page.getByLabel("Tu elección")).toContainText("Personaje: Cometa");
  await expect(page.getByLabel("Tu elección")).toContainText("Fondo: Arrecife");
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);

  // Leaving and coming back, even after a reload, keeps both scene selections.
  await page.getByRole("button", { name: "Mapa" }).click();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await expect(backdrop).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Cometa", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.reload();
  await expect(backdrop).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Cometa", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: "Crear escena" }).click();
  await expect(
    page.getByRole("group", { name: "Personajes" }).getByRole("button").first(),
  ).toContainText("Cometa");
});
