import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures.js";
import { reloadToMap } from "./helpers.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

async function enterScore(page: Page) {
  await page.goto("/kids");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🦊", stars: 3, done: {} }),
    );
    for (const id of ["kids.m1.straight", "kids.m2.corner", "kids.m3.zigzag"]) {
      localStorage.setItem(
        `agorix:kids.space.${id}`,
        JSON.stringify({
          schemaVersion: "agorix/program/v1",
          program: { schema: "agorix/program/v1", scripts: [] },
          metadata: {
            createdAt: "2026-10-22T00:00:00.000Z",
            updatedAt: "2026-10-22T00:00:00.000Z",
            missionProgress: 1,
            hintLevel: 0,
            locale: "es",
          },
        }),
      );
    }
  });
  await reloadToMap(page);
  await page.getByRole("button", { name: /Nivel avanzado/ }).click();
  await page.getByRole("button", { name: /\+ Cambiar disfraz/ }).click();
  await page.getByRole("button", { name: /\+ Tocar sonido/ }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await page.getByRole("button", { name: /Etapa 2/ }).click();
  await page.getByRole("button", { name: /\+ Cambiar disfraz/ }).click();
  await page.getByRole("button", { name: "Tocar a Ori" }).click();
  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await page.getByRole("button", { name: /Etapa 3/ }).click();
}

test("advanced list blocks edit canonical data and the watcher follows runtime", async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await enterScore(page);
  await expect(page.getByRole("button", { name: /Crear mi lista/ })).toBeVisible();
  await page.getByRole("button", { name: /Crear mi lista/ }).click();
  await expect(page.getByRole("status", { name: "Mi lista: Vacía" })).toBeVisible();
  await page.getByRole("spinbutton", { name: "Número para agregar" }).fill("7");
  await page.getByRole("button", { name: /Agregar 7 a mi lista/ }).click();
  await page.getByRole("spinbutton", { name: "Número para agregar" }).fill("9");
  await page.getByRole("button", { name: /Agregar 9 a mi lista/ }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByRole("status", { name: "Mi lista: 7, 9" })).toBeVisible();
  await page.getByRole("spinbutton", { name: /Posición/ }).fill("");
  await page.getByRole("button", { name: /Poner largo de lista en puntaje/ }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByRole("status", { name: "Puntaje: 2" })).toBeVisible();
  await page.getByRole("spinbutton", { name: /Posición/ }).fill("2");
  await page.getByRole("button", { name: /Poner elemento 2 en puntaje/ }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByRole("status", { name: "Puntaje: 9" })).toBeVisible();
  await page.getByRole("spinbutton", { name: /Posición/ }).fill("1");
  await page.getByRole("button", { name: /Quitar posición 1/ }).click();
  await page.getByRole("button", { name: /Poner largo de lista en puntaje/ }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByRole("status", { name: "Mi lista: 9" })).toBeVisible();
  await expect(page.getByRole("status", { name: "Puntaje: 1" })).toBeVisible();
  await expect(page.getByLabel("Código del programa").last()).toContainText("Mi lista");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter((item) => ["critical", "serious"].includes(item.impact ?? "")),
  ).toEqual([]);
  await reloadToMap(page);
  await page.getByRole("button", { name: /Etapa 3/ }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByRole("status", { name: "Mi lista: 9" })).toBeVisible();
});

test(".agorix export and import restore the list and its blocks", async ({ page }) => {
  await enterScore(page);
  await page.getByRole("button", { name: /Crear mi lista/ }).click();
  await page.getByRole("spinbutton", { name: "Número para agregar" }).fill("3");
  await page.getByRole("button", { name: /Agregar 3 a mi lista/ }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exportar .agorix" }).click(),
  ]);
  const path = await download.path();
  expect(path).not.toBeNull();
  await page.getByRole("button", { name: "Deshacer" }).click();
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByRole("status", { name: /Mi lista/ })).toHaveCount(0);
  await page.getByLabel("Importar .agorix").setInputFiles(path!);
  await page.getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByRole("status", { name: "Mi lista: 3" })).toBeVisible();
});

test("bad indices and values stay safe; Ori still proposes a reviewable score block", async ({
  page,
}) => {
  await enterScore(page);
  await page.getByRole("button", { name: /Crear mi lista/ }).click();
  await page.getByRole("spinbutton", { name: /Posición/ }).fill("0");
  await page.getByRole("button", { name: /Poner elemento 0 en puntaje/ }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByRole("status", { name: "Puntaje: 0" })).toBeVisible();
  await page.getByRole("spinbutton", { name: /Posición/ }).fill("-1");
  await page.getByRole("button", { name: /Quitar posición -1/ }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByRole("status", { name: "Mi lista: Vacía" })).toBeVisible();
  await page.getByRole("spinbutton", { name: "Número para agregar" }).fill("1.5");
  await page.getByRole("button", { name: /Agregar 1.5 a mi lista/ }).click();
  await expect(page.getByRole("status").last()).toContainText("número entero");
  await page.getByRole("button", { name: "Pedirle una idea a Ori" }).click();
  const review = page.getByLabel("Ori propone agregar");
  await expect(review).toBeVisible();
  await review.getByRole("button", { name: "No usar" }).click();
  await page.getByRole("button", { name: "Pedirle una idea a Ori" }).click();
  await review.getByRole("button", { name: "Agregar bloque" }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByRole("status", { name: /Puntaje: [12]/ })).toBeVisible();
});

test("list controls have English copy and work from a keyboard", async ({ page }) => {
  await enterScore(page);
  await page.evaluate(() => localStorage.setItem("agorix.locale", "en"));
  await reloadToMap(page);
  await page.getByRole("button", { name: /Stage 3/ }).click();
  const create = page.getByRole("button", { name: /Create my list/ });
  await create.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status", { name: "My list: Empty" })).toBeVisible();
  const input = page.getByRole("spinbutton", { name: "Number to add" });
  await input.fill("4");
  const add = page.getByRole("button", { name: /Add 4 to my list/ });
  await add.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByRole("status", { name: "My list: 4" })).toBeVisible();
});
