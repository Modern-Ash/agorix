import { expect, test, type Page } from "@playwright/test";

// Issue #437: the golden Kids journey. Every additive Kids v2 change must keep it green.
test.use({ hasTouch: true, serviceWorkers: "block" });

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "tablet landscape", width: 1180, height: 820 },
] as const;

async function play(
  page: Page,
  steps: number,
  prediction: "Sí" | "No" | "No sé",
  extraMove = false,
) {
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  await page.getByRole("combobox", { name: "mover 1" }).selectOption(String(steps));
  if (extraMove) await page.getByRole("button", { name: "+ mover", exact: true }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: prediction, exact: true }).click();
}

for (const viewport of VIEWPORTS) {
  test(`golden journey at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/kids");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Onboarding: Spanish by default, avatar, Ori.
    await expect(page.getByRole("heading", { name: "¡Hola!" })).toBeVisible();
    await page.getByRole("button", { name: "Seguir" }).click();
    await page.getByRole("button", { name: "🐼" }).click();
    await page.getByRole("button", { name: "Seguir" }).click();
    await page.getByRole("button", { name: "¡Empezar!" }).click();
    await expect(page.getByRole("heading", { name: "Mapa" })).toBeVisible();

    // Wrong programs report the runtime outcome: short, then wall.
    await page.getByRole("button", { name: "Misión 1" }).click();
    await play(page, 2, "No");
    await expect(page.getByRole("status")).toContainText("Se detuvo a");
    await page.getByRole("button", { name: "Volver", exact: true }).click();
    await page.getByRole("combobox", { name: "mover 1" }).selectOption("5");
    await page.getByRole("button", { name: "+ mover", exact: true }).click();
    await page.getByRole("button", { name: "Jugar", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "No", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Chocó con el borde");

    // Fix it: remove the extra block by undoing, set 4, win.
    await page.getByRole("button", { name: "Deshacer" }).click();
    await page.getByRole("button", { name: "Volver", exact: true }).click();
    await page.getByRole("combobox", { name: "mover 1" }).selectOption("4");
    await page.getByRole("button", { name: "Jugar", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Sí", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Llegaste");

    // Reflection without free text, then the next mission is unlocked.
    await page.getByRole("button", { name: "Contar ★" }).click();
    await expect(page.getByRole("heading", { name: /llegó/ })).toBeVisible();
    await page.getByRole("button", { name: "mover", exact: true }).click();
    await page.getByRole("button", { name: "😊" }).click();
    await page.getByRole("button", { name: "Próxima misión" }).click();
    await page.getByRole("button", { name: /Mapa/ }).first().click();
    await expect(page.locator(".kids-stars")).toHaveText("★1");

    // Projects and the adults gate.
    await page.getByRole("button", { name: /Mis proyectos/ }).click();
    await expect(page.getByRole("heading", { name: "Mis proyectos" })).toBeVisible();
    await page.getByRole("button", { name: "Adultos" }).click();
    await expect(page.getByRole("heading", { name: "¿Cuánto es 7 + 5?" })).toBeVisible();
    await page.getByRole("button", { name: "1", exact: true }).click();
    await page.getByRole("button", { name: "2", exact: true }).click();
    await page.getByRole("button", { name: "Comprobar" }).click();
    await expect(page.getByRole("heading", { name: "Estado de la IA" })).toBeVisible();
    await expect(page.getByText("Misiones completadas")).toBeVisible();
  });
}
