import { expect, test, type Page } from "./fixtures.js";
import { KIDS_V2_FEATURES } from "../src/kids/kidsFlags.js";
import { passAdultGate, openAdultTab } from "./helpers.js";

// Issue #437: the golden Kids journey. Every additive Kids v2 change must keep it green.
test.use({ hasTouch: true, serviceWorkers: "block" });

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "tablet landscape", width: 1180, height: 820 },
] as const;

async function addMoves(page: Page, count: number) {
  const motion = page
    .getByRole("navigation", { name: "Categorías de bloques" })
    .getByRole("button", { name: "Movimiento" });
  for (let index = 0; index < count; index += 1) {
    await motion.click();
    await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  }
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
}

// The journey must pass with every v2 flag off (today's behaviour) and every one on.
const FLAG_SETS = [
  { name: "flags off", flags: [] as string[] },
  { name: "all v2 flags on", flags: [...KIDS_V2_FEATURES] as string[] },
] as const;

for (const { name: flagSet, flags } of FLAG_SETS)
  for (const viewport of VIEWPORTS) {
    test(`golden journey at ${viewport.name}, ${flagSet}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/kids");
      await page.evaluate((list) => {
        localStorage.clear();
        localStorage.setItem("agorix.kids.flags.v1", JSON.stringify(list));
      }, flags);
      await page.reload();

      // Onboarding: Spanish by default, avatar, Ori.
      await expect(page.getByRole("heading", { name: "¡Hola!" })).toBeVisible();
      await page.getByRole("button", { name: "Seguir" }).click();
      await page.getByRole("button", { name: "🐼" }).click();
      await page.getByRole("button", { name: "Seguir" }).click();
      await page.getByRole("button", { name: "¡Empezar!" }).click();
      await expect(page.getByRole("heading", { name: "Mapa" })).toBeVisible();

      // A wrong program says so, in the child's own scene; the right one reaches the goal.
      await page.getByRole("button", { name: "Misión 1" }).click();
      await addMoves(page, 2);
      await expect(page.getByTestId("scene-goal-result")).toContainText("Todavía no");
      await addMoves(page, 2);
      await expect(page.getByTestId("scene-goal-result")).toContainText("Lograste la meta");
      await page.getByRole("button", { name: "Volver al mapa" }).click();
      await expect(page.locator(".kids-stars")).toHaveText("★1");

      // Projects and the adults gate.
      await page.getByRole("button", { name: /Mis proyectos/ }).click();
      await expect(page.getByRole("heading", { name: "Mis proyectos" })).toBeVisible();
      await page.getByRole("button", { name: "Adultos" }).click();
      await expect(page.getByRole("heading", { name: /¿Cuánto es \d+ × \d+\?/ })).toBeVisible();
      await passAdultGate(page);
      await expect(page.getByText("Misiones completadas")).toBeVisible();
      await openAdultTab(page, "Cuenta y privacidad");
      await expect(page.getByRole("heading", { name: "Estado de la IA" })).toBeVisible();
    });
  }
