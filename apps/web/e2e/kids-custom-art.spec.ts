import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

test.use({ hasTouch: true, serviceWorkers: "block" });

async function seed(page: Page) {
  await page.goto("/kids");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem("agorix.kids.flags.v1", JSON.stringify(["customImages"]));
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  });
  await page.reload();
}

async function openAdults(page: Page) {
  await page.getByRole("button", { name: "Adultos" }).click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "2", exact: true }).click();
  await page.getByRole("button", { name: "Comprobar" }).click();
}

test("a built-in image renders locally across map, creation, editor and prediction", async ({
  page,
}) => {
  await seed(page);
  await openAdults(page);
  const panel = page.getByRole("region", { name: "Imágenes del juego" });
  await panel
    .getByLabel("Elegir imagen para Explorador 🐸")
    .setInputFiles(resolve("e2e/fixtures/kids-solid.png"));
  await panel
    .getByLabel("Elegir imagen para Fondo Espacio")
    .setInputFiles(resolve("e2e/fixtures/kids-solid.png"));
  await page.getByRole("button", { name: "Mapa" }).click();
  await expect(page.locator(".kids-avatar-badge")).toHaveCSS(
    "background-image",
    /data:image\/(webp|png)/,
  );
  await expect(page.locator(".kids-avatar-badge")).toHaveAttribute("aria-label", "🐸");
  await expect(page.locator(".kids-path")).toHaveCSS("background-image", /data:image\/(webp|png)/);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Elegí tu personaje: 🐸" }).locator(".kids-art-image"),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "¡Crear!" }).click();
  await expect(page.locator(".kids-world-avatar")).toHaveCSS(
    "background-image",
    /data:image\/(webp|png)/,
  );
  await expect(page.locator(".kids-world-grid")).toHaveCSS(
    "background-image",
    /data:image\/(webp|png)/,
  );
  await page.locator(".kids-goal-cell").nth(16).click();
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByRole("dialog").locator(".kids-predict-avatar")).toHaveCSS(
    "background-image",
    /data:image\/(webp|png)/,
  );
  await page.getByRole("dialog").getByRole("button", { name: "No", exact: true }).click();
  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await expect(page.locator(".kids-project-thumb .kids-art-image")).toHaveCount(1);
  await expect(page.locator(".kids-project-thumb")).toHaveCSS(
    "background-image",
    /data:image\/(webp|png)/,
  );
  await page.getByRole("button", { name: "Mapa" }).click();
  await page.getByRole("button", { name: "Misión 1" }).click();
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  await page.getByRole("combobox", { name: "mover 1" }).selectOption("4");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sí", exact: true }).click();
  await page.getByRole("button", { name: "Contar ★" }).click();
  await expect(page.locator(".kids-reflect-hero .kids-art-image")).toHaveCount(1);
  const policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute("content");
  expect(policy).toContain("img-src 'self' data:");
});

test("adult adds custom explorer and backdrop; new free project retains them, deletion falls back", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "¡Crear!" }).click();
  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await openAdults(page);
  const panel = page.getByRole("region", { name: "Imágenes del juego" });
  await panel.getByLabel("+ Explorador").setInputFiles(resolve("e2e/fixtures/kids-solid.png"));
  await panel.getByLabel("+ Fondo").setInputFiles(resolve("e2e/fixtures/kids-solid.png"));
  await expect(panel.getByRole("status")).toHaveText("Imagen guardada en este dispositivo.");
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Explorador propio 1" }).click();
  await page.getByRole("button", { name: "Fondo propio 2" }).click();
  await page.getByRole("button", { name: "¡Crear!" }).click();
  await expect(page.locator(".kids-world-avatar")).toHaveCSS(
    "background-image",
    /data:image\/(webp|png)/,
  );
  await expect(page.locator(".kids-world-grid")).toHaveCSS(
    "background-image",
    /data:image\/(webp|png)/,
  );
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  const cards = page.locator(".kids-project-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0).locator(".kids-art-image")).toHaveCount(0);
  await expect(cards.nth(0).locator(".kids-project-thumb")).toHaveCSS("background-image", "none");
  await expect(cards.nth(1).locator(".kids-art-image")).toHaveCount(1);
  await expect(cards.nth(1).locator(".kids-project-thumb")).toHaveCSS(
    "background-image",
    /data:image\/(webp|png)/,
  );
  await cards.nth(1).getByRole("button", { name: "Jugar" }).click();
  await expect(page.locator(".kids-world-avatar")).toHaveCSS(
    "background-image",
    /data:image\/(webp|png)/,
  );
  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await openAdults(page);
  await page
    .getByRole("region", { name: "Imágenes del juego" })
    .getByRole("button", { name: "Quitar imagen de 1" })
    .click();
  await page
    .getByRole("region", { name: "Imágenes del juego" })
    .getByRole("button", { name: "Quitar imagen de 2" })
    .click();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await expect(cards.nth(1).locator(".kids-art-image")).toHaveCount(0);
  await expect(cards.nth(1).locator(".kids-project-thumb")).toHaveCSS("background-image", "none");
  await expect(cards.nth(1).locator(".kids-project-thumb")).toContainText("🦊");
});
