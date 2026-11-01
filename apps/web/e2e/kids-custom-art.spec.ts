import AxeBuilder from "@axe-core/playwright";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { passAdultGate, reloadTo, openAdultTab } from "./helpers.js";

test.use({ hasTouch: true, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("agorix.kids.freeToScene.off.v1", "1"));
});

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

async function openAdults(page: Page, tab = "Personalizar") {
  await page.getByRole("button", { name: "Adultos" }).click();
  await passAdultGate(page);
  await openAdultTab(page, tab);
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
  await reloadTo(page, "#/proyectos");
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
  await reloadTo(page, "#/proyectos");
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
  await openAdults(page, "Ajustes");
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
  await reloadTo(page, "#/proyectos");
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

test("drawing tools fill, draw shapes, erase, flip, undo and redo on touch width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Dibujar explorador" }).click();
  const canvas = page.locator("canvas.kids-draw-canvas");
  const pixel = (x: number, y: number) =>
    canvas.evaluate(
      (element, [px, py]) =>
        Array.from(
          (element as HTMLCanvasElement)
            .getContext("2d")!
            .getImageData(px as number, py as number, 1, 1).data,
        ),
      [x, y],
    );
  // The page scrolls when a tool button is pressed, so measure the canvas right before touching it.
  const at = async (x: number, y: number) => {
    await canvas.scrollIntoViewIfNeeded();
    const box = (await canvas.boundingBox())!;
    return { x: box.x + (x * box.width) / 256, y: box.y + (y * box.height) / 256 };
  };
  const drag = async (fromX: number, fromY: number, toX: number, toY: number) => {
    const from = await at(fromX, fromY);
    const to = await at(toX, toY);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await page.mouse.up();
  };

  await page.getByRole("button", { name: "Color #ef627d" }).click();
  await page.getByRole("button", { name: "Rellenar" }).click();
  await expect(page.getByRole("button", { name: "Rellenar" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const middle = await at(128, 128);
  await page.mouse.click(middle.x, middle.y);
  expect(await pixel(128, 128)).toEqual([239, 98, 125, 255]);

  await page.getByRole("button", { name: "Deshacer trazo" }).click();
  expect((await pixel(128, 128))[3]).toBe(0);
  await page.getByRole("button", { name: "Rehacer trazo" }).click();
  expect(await pixel(128, 128)).toEqual([239, 98, 125, 255]);

  await page.getByRole("button", { name: "Goma" }).click();
  await drag(100, 128, 156, 128);
  expect((await pixel(128, 128))[3]).toBe(0);

  await page.getByRole("button", { name: "Color #548de4" }).click();
  await page.getByRole("button", { name: "Rectángulo" }).click();
  await drag(20, 20, 60, 60);
  expect(await pixel(40, 20)).toEqual([84, 141, 228, 255]);
  expect((await pixel(40, 40))[3]).toBe(255);

  await page.getByRole("button", { name: "Voltear dibujo" }).click();
  expect(await pixel(255 - 40, 20)).toEqual([84, 141, 228, 255]);

  await page.getByRole("button", { name: "Borrar dibujo" }).click();
  expect((await pixel(128, 40))[3]).toBe(0);
  await page.getByRole("button", { name: "Deshacer trazo" }).click();
  expect(await pixel(255 - 40, 20)).toEqual([84, 141, 228, 255]);

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await page.getByRole("button", { name: "Guardar dibujo" }).click();
  await expect(page.getByRole("button", { name: "Explorador propio 1" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("drawing layers, filled shapes, text and select-and-move work and undo", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Dibujar explorador" }).click();
  const front = page.locator("canvas.kids-draw-canvas");
  const back = page.locator("canvas.kids-draw-layer:not(.kids-draw-selection)");
  const pixel = (canvas: typeof front, x: number, y: number) =>
    canvas.evaluate(
      (element, [px, py]) =>
        Array.from(
          (element as HTMLCanvasElement)
            .getContext("2d")!
            .getImageData(px as number, py as number, 1, 1).data,
        ),
      [x, y],
    );
  const at = async (x: number, y: number) => {
    await front.evaluate((element) => element.scrollIntoView({ block: "center" }));
    const box = (await front.boundingBox())!;
    return { x: box.x + (x * box.width) / 256, y: box.y + (y * box.height) / 256 };
  };
  const drag = async (fromX: number, fromY: number, toX: number, toY: number) => {
    const from = await at(fromX, fromY);
    const to = await at(toX, toY);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await page.mouse.up();
  };

  await page.getByRole("button", { name: "Capa de atrás" }).click();
  await page.getByRole("button", { name: "Color #ef627d" }).click();
  await page.getByRole("button", { name: "Rellenar" }).click();
  const middle = await at(200, 200);
  await page.mouse.click(middle.x, middle.y);
  expect(await pixel(back, 200, 200)).toEqual([239, 98, 125, 255]);
  expect((await pixel(front, 200, 200))[3]).toBe(0);

  await page.getByRole("button", { name: "Capa del frente" }).click();
  await page.getByRole("button", { name: "Color #548de4" }).click();
  await page.getByLabel("Formas rellenas").check();
  await page.getByRole("button", { name: "Rectángulo" }).click();
  await drag(20, 20, 60, 60);
  expect(await pixel(front, 40, 40)).toEqual([84, 141, 228, 255]);

  await page.getByRole("button", { name: "Seleccionar y mover" }).click();
  await drag(10, 10, 70, 70);
  await drag(40, 40, 140, 140);
  expect(await pixel(front, 140, 140)).toEqual([84, 141, 228, 255]);
  expect((await pixel(front, 40, 40))[3]).toBe(0);
  await page.getByRole("button", { name: "Deshacer trazo" }).click();
  expect(await pixel(front, 40, 40)).toEqual([84, 141, 228, 255]);

  await page.getByRole("button", { name: "Texto", exact: true }).click();
  await page.getByRole("textbox", { name: "Palabra para estampar" }).fill("Hola");
  await page.getByRole("button", { name: "Color #252342" }).click();
  const spot = await at(100, 200);
  await page.mouse.click(spot.x, spot.y);
  const inked = await front.evaluate((element) => {
    const data = (element as HTMLCanvasElement)
      .getContext("2d")!
      .getImageData(100, 185, 80, 30).data;
    return Array.from(data).some((value, index) => index % 4 === 3 && value > 0);
  });
  expect(inked).toBe(true);

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await page.getByRole("button", { name: "Guardar dibujo" }).click();
  await expect(page.getByRole("button", { name: "Explorador propio 1" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
