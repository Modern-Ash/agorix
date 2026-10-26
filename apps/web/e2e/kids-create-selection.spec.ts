import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.use({ hasTouch: true, serviceWorkers: "block" });

// Issue #594: the explorer of a world and the character of Escena libre are two choices that stay
// marked together, remembered on this device, and the scene starts with its own character.
test("the explorer and the scene character stay chosen together, are remembered and start the scene", async ({
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
  const explorer = page.getByRole("button", { name: /Elegí tu personaje: 🐼|: 🐼$/ });
  const note = page.getByTestId("studio-start-note");
  // A scene character is always chosen, so the note never asks the child to pick.
  await expect(note).toHaveText("La escena empieza con Nova.");
  await expect(page.getByRole("button", { name: "Nova", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await explorer.click();
  await expect(explorer).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Cometa", exact: true }).click();
  // Choosing the second one leaves the first one chosen.
  await expect(explorer).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Cometa", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Nova", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(note).toHaveText("La escena empieza con Cometa.");
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);

  // Leaving and coming back, even after a reload, keeps both.
  await page.getByRole("button", { name: "Mapa" }).click();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await expect(explorer).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Cometa", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.reload();
  await expect(explorer).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Cometa", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: "Crear escena" }).click();
  await expect(
    page.getByRole("group", { name: "Personajes" }).getByRole("button").first(),
  ).toContainText("Cometa");
});
