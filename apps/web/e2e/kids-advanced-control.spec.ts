import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures.js";
import { reloadToMap } from "./helpers.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

async function enterControl(page: Page) {
  await page.goto("/kids");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🦊", stars: 3, done: {} }),
    );
    localStorage.setItem(
      "agorix.kids.missionScenes.v1",
      JSON.stringify({
        "kids.space.kids.m1.straight": "studio-1",
        "kids.space.kids.m2.corner": "studio-2",
        "kids.space.kids.m3.zigzag": "studio-3",
      }),
    );
    for (const id of ["kids.m1.straight", "kids.m2.corner", "kids.m3.zigzag"]) {
      localStorage.setItem(
        `agorix:studio-${["kids.m1.straight", "kids.m2.corner", "kids.m3.zigzag"].indexOf(id) + 1}`,
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
  await page.getByRole("button", { name: "+ Sumar 1" }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await page.getByRole("button", { name: /Etapa 4/ }).click();
}

test("control builds if/else, comparators, random and wait with runtime evidence", async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await enterControl(page);
  await page.getByRole("spinbutton", { name: /Primer número/ }).fill("2");
  await page.getByRole("spinbutton", { name: /Último número/ }).fill("4");
  await page.getByRole("button", { name: /Poner puntaje al azar/ }).click();
  await page.getByRole("button", { name: /Si puntaje ≥/ }).click();
  await page.getByRole("spinbutton", { name: /Primer número/ }).fill("5");
  await page.getByRole("button", { name: /Si puntaje </ }).click();
  await page.getByRole("spinbutton", { name: /Primer número/ }).fill("1");
  await page.getByRole("button", { name: /Esperar segundos/ }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByText("¡Misión lograda!").first()).toBeVisible();
  await expect(page.getByRole("status", { name: /Puntaje:/ })).toBeVisible();
  await expect(page.getByLabel("Código del programa")).toContainText("if");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exportar .agorix" }).click(),
  ]);
  const saved = await download.path();
  expect(saved).not.toBeNull();
  await page.getByRole("button", { name: "Deshacer" }).click();
  await page.getByLabel("Importar .agorix").setInputFiles(saved!);
  await expect(page.getByText("Esperar 1", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter((item) => ["critical", "serious"].includes(item.impact ?? "")),
  ).toEqual([]);
  await reloadToMap(page);
  await page.getByRole("button", { name: /Etapa 4/ }).click();
  await expect(page.getByText(/Azar 2–4/)).toBeVisible();
});

test("message sends to two handlers and survives export/import", async ({ page }) => {
  await enterControl(page);
  await page.getByRole("button", { name: /Si puntaje ≥/ }).click();
  await page.getByRole("button", { name: /Esperar segundos/ }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await page.getByRole("button", { name: /Etapa 5/ }).click();
  await page.getByRole("button", { name: /\+ Enviar mensaje/ }).click();
  await page.getByRole("button", { name: /Ori recibe/ }).click();
  await page.getByRole("button", { name: /Amiga recibe/ }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByText("¡Misión lograda!").first()).toBeVisible();
  await expect(page.getByText(/Amiga: avanzó 1/)).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exportar .agorix" }).click(),
  ]);
  const path = await download.path();
  expect(path).not.toBeNull();
  await page.getByRole("button", { name: "Deshacer" }).click();
  await page.getByLabel("Importar .agorix").setInputFiles(path!);
  await page.getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByText("¡Misión lograda!").first()).toBeVisible();
  await reloadToMap(page);
  await page.getByRole("button", { name: /Etapa 5/ }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByText("¡Misión lograda!").first()).toBeVisible();
});

test("advanced controls use English labels and keyboard actions", async ({ page }) => {
  await enterControl(page);
  await page.evaluate(() => localStorage.setItem("agorix.locale", "en"));
  await reloadToMap(page);
  await page.getByRole("button", { name: /Stage 4/ }).click();
  await expect(page.getByRole("heading", { name: "Choose what happens" })).toBeVisible();
  const add = page.getByRole("button", { name: /If score ≥/ });
  await add.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/If score ≥ 1/)).toBeVisible();
});

test("invalid controls are safe and Ori's stage proposal needs acceptance", async ({ page }) => {
  await enterControl(page);
  await page.getByRole("spinbutton", { name: /Primer número/ }).fill("8");
  await page.getByRole("spinbutton", { name: /Último número/ }).fill("2");
  await page.getByRole("button", { name: /Poner puntaje al azar/ }).click();
  await expect(page.getByRole("alert")).toContainText("último debe ser mayor");
  await page.getByRole("button", { name: "Pedirle una idea a Ori" }).click();
  const review = page.getByLabel("Ori propone agregar");
  await expect(review).toContainText("Esperar 1");
  await expect(page.getByLabel("Código del programa")).not.toContainText("wait");
  await review.getByRole("button", { name: "No usar" }).click();
  await page.getByRole("button", { name: "Pedirle una idea a Ori" }).click();
  await review.getByRole("button", { name: "Agregar bloque" }).click();
  await expect(page.getByLabel("Código del programa")).toContainText("wait");
  await page.getByRole("button", { name: "Jugar" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Probá otro bloque/)).toBeVisible();
});
