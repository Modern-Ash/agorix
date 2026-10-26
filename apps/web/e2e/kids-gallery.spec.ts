import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

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
  await page
    .getByRole("group", { name: "Categorías de fondos" })
    .getByRole("button", { name: "Naturaleza" })
    .click();
  await page.getByRole("button", { name: "Bosque", exact: true }).click();
  await expect(page.getByRole("button", { name: "Nova", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Bosque", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByLabel("Tu elección")).toContainText("Personaje: Nova");
  await expect(page.getByLabel("Tu elección")).toContainText("Fondo: Bosque");

  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);

  await page.getByRole("button", { name: "¡Crear!" }).click();
  await expect(page.locator(".kids-world-grid.kids-art-backdrop")).toBeVisible();
  await expect(page.locator(".kids-world-avatar.kids-art-image")).toBeVisible();
  await page.reload();
  await page.evaluate(() => {
    location.hash = "#/proyectos";
  });
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await expect(page.locator(".kids-project-card .kids-art-backdrop")).toBeVisible();
  await page.locator(".kids-project-card").getByRole("button", { name: "Jugar" }).click();
  await expect(page.locator(".kids-world-grid.kids-art-backdrop")).toBeVisible();
  await expect(page.locator(".kids-world-avatar.kids-art-image")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("agorix.kids.projects.v2"))).toContain(
    '"id":"forest"',
  );

  await page.getByRole("button", { name: "+ sonar", exact: true }).click();
  await page.getByRole("button", { name: "Galería de sonidos" }).click();
  const soundGallery = page.getByRole("dialog", { name: "Galería de sonidos" });
  await soundGallery.getByRole("button", { name: "Naturaleza" }).click();
  await expect(soundGallery.getByText("Salpicadura")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "sonar 1" })).toHaveValue("kids-tone");
  await soundGallery.getByRole("button", { name: "Escuchar Salpicadura" }).click();
  await expect(page.getByRole("combobox", { name: "sonar 1" })).toHaveValue("kids-tone");
  await soundGallery.getByRole("button", { name: "Elegir Salpicadura" }).click();
  await expect(page.getByRole("combobox", { name: "sonar 1" })).toHaveValue("kids:splash");
  await page.reload();
  await page.evaluate(() => {
    location.hash = "#/proyectos";
  });
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page.locator(".kids-project-card").getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByRole("combobox", { name: "sonar 1" })).toHaveValue("kids:splash");
});
