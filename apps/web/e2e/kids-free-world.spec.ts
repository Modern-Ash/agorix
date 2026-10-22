import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.use({ hasTouch: true, serviceWorkers: "block" });

async function seed(page: Page) {
  await page.goto("/kids");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  });
  await page.reload();
}

test("creates a reachable free goal, reflects without text, and exports/imports the project", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Elegí tu personaje: 🐼" }).click();
  await page.getByRole("button", { name: "Océano" }).click();
  await page.getByRole("button", { name: "¡Crear!" }).click();
  await expect(page.getByRole("button", { name: "Jugar", exact: true })).toBeDisabled();
  const freeViolations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(freeViolations.map((v) => v.id)).toEqual([]);
  await page.getByRole("button", { name: "Tocá el mundo para poner la meta: 5, 3" }).click();
  await expect(page.getByRole("button", { name: "Jugar", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  await page.getByRole("combobox", { name: "mover 1" }).selectOption("4");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sí", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Llegaste");
  await page.getByRole("button", { name: "Contar ★" }).click();
  await expect(page.getByRole("heading", { name: /llegó/ })).toBeVisible();
  const reflectViolations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(reflectViolations.map((v) => v.id)).toEqual([]);
  await page.getByRole("button", { name: "mover", exact: true }).click();
  await page.getByRole("button", { name: "😊" }).click();
  await page.getByRole("button", { name: "Próxima misión" }).click();
  const reflection = await page.evaluate(() =>
    sessionStorage.getItem("agorix.kids.reflections.v1"),
  );
  expect(reflection).toContain('"kind":"reflectionRecorded"');
  expect(reflection).not.toContain("😊");
  expect(reflection).not.toContain("🐼");
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await expect(page.locator(".kids-project-card")).toHaveCount(1);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.agorix$/);
  const path = await download.path();
  expect(path).not.toBeNull();
  await page.locator(".kids-import-label input").setInputFiles(path!);
  await expect(page.locator("[data-screen='editor']")).toBeVisible();
  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await expect(page.locator(".kids-project-card")).toHaveCount(2);
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(violations.map((v) => v.id)).toEqual([]);
});

test("free goal rejects the start and keeps the program on reload", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "¡Crear!" }).click();
  await expect(
    page.getByRole("button", { name: "Tocá el mundo para poner la meta: 1, 3" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Tocá el mundo para poner la meta: 3, 3" }).click();
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  await page.getByRole("combobox", { name: "mover 1" }).selectOption("2");
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page.locator(".kids-project-card").getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByRole("combobox", { name: "mover 1" })).toHaveValue("2");
  await expect(
    page.getByRole("button", { name: "Tocá el mundo para poner la meta: 3, 3" }),
  ).toHaveAttribute("aria-pressed", "true");
});
