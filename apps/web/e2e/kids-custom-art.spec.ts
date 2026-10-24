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

test("child adds custom explorer and backdrop from Create without entering Adults", async ({
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
  await expect(page.getByText("+ Explorador")).toBeVisible();
  await expect(page.getByText("+ Fondo")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.getByRole("region", { name: "Imágenes del juego" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Quitar imagen de/ })).toHaveCount(0);
  await page.getByLabel("+ Explorador").setInputFiles(resolve("e2e/fixtures/kids-solid.png"));
  await expect(page.getByRole("button", { name: "Explorador propio 1" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByLabel("+ Fondo").setInputFiles(resolve("e2e/fixtures/kids-solid.png"));
  await expect(page.getByRole("button", { name: "Fondo propio 2" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("heading", { name: "Crear" })).toBeVisible();
  await page.getByRole("button", { name: "¡Crear!" }).click();
  await expect(page.locator(".kids-world-avatar")).toHaveCSS("background-image", /data:image/);
  await expect(page.locator(".kids-world-grid")).toHaveCSS("background-image", /data:image/);
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page.locator(".kids-project-card").getByRole("button", { name: "Jugar" }).click();
  await expect(page.locator(".kids-world-avatar")).toHaveCSS("background-image", /data:image/);
  await expect(page.locator(".kids-world-grid")).toHaveCSS("background-image", /data:image/);
});

test("child draws an explorer and backdrop, then reopens both in a local project", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Dibujar explorador" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const explorerCanvas = page.getByRole("img", { name: "Lienzo para dibujar" });
  const explorerBounds = await explorerCanvas.boundingBox();
  expect(explorerBounds).not.toBeNull();
  await page.mouse.move(explorerBounds!.x + 40, explorerBounds!.y + 40);
  await page.mouse.down();
  await page.mouse.move(explorerBounds!.x + 150, explorerBounds!.y + 150, { steps: 8 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Guardar dibujo" }).click();
  await expect(page.getByRole("button", { name: "Explorador propio 1" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: "Dibujar fondo" }).click();
  const backdropCanvas = page.getByRole("img", { name: "Lienzo para dibujar" });
  const backdropBounds = await backdropCanvas.boundingBox();
  expect(backdropBounds).not.toBeNull();
  await page.mouse.click(backdropBounds!.x + 90, backdropBounds!.y + 90);
  await page.getByRole("button", { name: "Guardar dibujo" }).click();
  await expect(page.getByRole("button", { name: "Fondo propio 2" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "¡Crear!" }).click();
  await expect(page.locator(".kids-world-avatar")).toHaveCSS("background-image", /data:image/);
  await expect(page.locator(".kids-world-grid")).toHaveCSS("background-image", /data:image/);
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page.locator(".kids-project-card").getByRole("button", { name: "Jugar" }).click();
  await expect(page.locator(".kids-world-avatar")).toHaveCSS("background-image", /data:image/);
  await expect(page.locator(".kids-world-grid")).toHaveCSS("background-image", /data:image/);
});

test("a failed canvas export keeps the drawing open and adds no image", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Dibujar explorador" }).click();
  await page.evaluate(() => {
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      callback(null);
    };
  });
  await page.getByRole("button", { name: "Guardar dibujo" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "No pudimos reducir esa imagen a menos de 60 KB.",
  );
  await expect(page.getByRole("img", { name: "Lienzo para dibujar" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Explorador propio/ })).toHaveCount(0);
});

test("child cannot replace bundled images and adult can disable custom image uploads", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await expect(page.getByText("+ Explorador")).toBeVisible();
  await expect(page.getByText("+ Fondo")).toBeVisible();
  await expect(page.getByLabel(/Elegir imagen para Explorador/)).toHaveCount(0);
  await expect(page.getByLabel(/Elegir imagen para Fondo/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Quitar imagen de/ })).toHaveCount(0);
  await openAdults(page);
  await page.getByRole("switch", { name: /Imágenes propias/ }).click();
  await expect(page.getByRole("switch", { name: /Imágenes propias/ })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await expect(page.getByRole("region", { name: "Imágenes del juego" })).toHaveCount(0);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await expect(page.getByLabel("+ Explorador")).toHaveCount(0);
  await expect(page.getByLabel("+ Fondo")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Dibujar explorador" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Dibujar fondo" })).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await expect(page.getByLabel("+ Explorador")).toHaveCount(0);
});

test("invalid child image is rejected locally without adding a choice", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByLabel("+ Explorador").setInputFiles({
    name: "renamed.png",
    mimeType: "image/png",
    buffer: Buffer.from("<svg></svg>"),
  });
  await expect(page.getByRole("status")).toHaveText("Elegí un archivo PNG, JPEG o WebP.");
  await expect(page.getByRole("button", { name: /Explorador propio/ })).toHaveCount(0);
});

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

test("child-added explorer and backdrop persist; adult removal falls back", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "¡Crear!" }).click();
  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByLabel("+ Explorador").setInputFiles(resolve("e2e/fixtures/kids-solid.png"));
  await page.getByLabel("+ Fondo").setInputFiles(resolve("e2e/fixtures/kids-solid.png"));
  await expect(page.getByRole("status")).toHaveText("Imagen guardada en este dispositivo.");
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
