import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

test.use({ hasTouch: true, serviceWorkers: "block" });

async function start(page: Page, enabled: boolean) {
  await page.goto("/kids");
  await page.evaluate((flag) => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem("agorix.kids.flags.v1", JSON.stringify(flag ? ["customImages"] : []));
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  }, enabled);
  await page.reload();
}

async function openAdults(page: Page) {
  await page.getByRole("button", { name: "Adultos" }).click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "2", exact: true }).click();
  await page.getByRole("button", { name: "Comprobar" }).click();
}

test("adult saves a local Ori image, reloads and removes it", async ({ page }) => {
  await start(page, true);
  await expect(page.getByText("Imágenes del juego")).toHaveCount(0);
  await openAdults(page);
  const panel = page.getByRole("region", { name: "Imágenes del juego" });
  await expect(panel).toContainText("Estas imágenes se quedan en este dispositivo.");
  await expect(panel.getByRole("img")).toHaveCount(11);
  await panel
    .getByLabel("Elegir imagen para Ori")
    .setInputFiles(resolve("e2e/fixtures/kids-gps-zero.jpg"));
  await expect(panel.getByRole("status")).toHaveText("Imagen guardada en este dispositivo.");
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("agorix.kids.imgs.v1") ?? "{}"),
  );
  expect(saved.ori).toMatch(/^data:image\/(webp|png);base64,/);
  await expect(panel.getByText(/Espacio usado: [1-9]/)).toBeVisible();
  await page.reload();
  await openAdults(page);
  const afterReload = page.getByRole("region", { name: "Imágenes del juego" });
  await expect(afterReload.getByRole("button", { name: "Quitar imagen de Ori" })).toBeVisible();
  await afterReload.getByRole("button", { name: "Quitar imagen de Ori" }).click();
  await expect(afterReload.getByRole("status")).toHaveText("Imagen quitada.");
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("agorix.kids.imgs.v1") ?? "{}")),
  ).toEqual({});
});

test("invalid format and blocked storage show an adult message without crashing", async ({
  page,
}) => {
  await start(page, true);
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "agorix.kids.imgs.v1") throw new DOMException("quota", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.reload();
  await openAdults(page);
  const panel = page.getByRole("region", { name: "Imágenes del juego" });
  await panel.getByLabel("Elegir imagen para Ori").setInputFiles({
    name: "renamed.png",
    mimeType: "image/png",
    buffer: Buffer.from("<svg></svg>"),
  });
  await expect(panel.getByRole("status")).toHaveText("Elegí un archivo PNG, JPEG o WebP.");
  await panel
    .getByLabel("Elegir imagen para Ori")
    .setInputFiles(resolve("e2e/fixtures/kids-solid.png"));
  await expect(panel.getByRole("status")).toContainText("No se pudo guardar.");
  await expect(panel.getByRole("button", { name: "Quitar todas" })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Adultos" })).toBeVisible();
});

test("image settings remain hidden when the feature flag is off", async ({ page }) => {
  await start(page, false);
  await openAdults(page);
  await expect(page.getByRole("region", { name: "Imágenes del juego" })).toHaveCount(0);
});
