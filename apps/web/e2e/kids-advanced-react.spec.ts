import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures.js";
import { reloadToMap } from "./helpers.js";

test.use({ hasTouch: true });

async function seed(page: import("@playwright/test").Page) {
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
}

test("stage 2 unlocks after the real scene, reacts to a child tap, and replays stage 1", async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await seed(page);
  await expect(page.getByRole("button", { name: /Etapa 2/ })).toHaveCount(0);
  await page.getByRole("button", { name: /Nivel avanzado/ }).click();
  await page.getByRole("button", { name: /\+ Cambiar disfraz/ }).click();
  await page.getByRole("button", { name: /\+ Tocar sonido/ }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByRole("status")).toContainText("Escena lograda");
  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await page.getByRole("button", { name: /Etapa 2/ }).click();
  await expect(page.getByRole("heading", { name: "Hacé que reaccione" })).toBeVisible();
  await expect(page.getByLabel("Código del programa").last()).toContainText("when actor clicked");
  await page.getByRole("button", { name: /\+ Cambiar disfraz/ }).click();
  await page.getByRole("button", { name: "Tocar a Ori" }).click();
  await expect(page.getByRole("status")).toContainText("Reacción lograda");
  await reloadToMap(page);
  await page.getByRole("button", { name: /Etapa 2/ }).click();
  await expect(page.getByRole("status")).toContainText("Reacción lograda");
  const editorAxe = await new AxeBuilder({ page }).analyze();
  expect(
    editorAxe.violations.filter((violation) =>
      ["critical", "serious"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await expect(page.getByRole("button", { name: /Nivel avanzado/ })).toBeVisible();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? "")),
  ).toEqual([]);
});

test("stage-2 Ori fallback previews, rejects and accepts a click-scoped proposal", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("button", { name: /Nivel avanzado/ }).click();
  await page.getByRole("button", { name: /\+ Cambiar disfraz/ }).click();
  await page.getByRole("button", { name: /\+ Tocar sonido/ }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await page.getByRole("button", { name: /Etapa 2/ }).click();
  await page.getByRole("button", { name: "Pedirle una idea a Ori" }).click();
  const review = page.getByLabel("Ori propone agregar");
  await expect(review).toContainText("Cambiar disfraz");
  await expect(page.getByLabel("Código del programa").last()).not.toContainText("switch costume");
  await review.getByRole("button", { name: "No usar" }).click();
  await expect(review).toHaveCount(0);
  await page.getByRole("button", { name: "Pedirle una idea a Ori" }).click();
  await review.getByRole("button", { name: "Agregar bloque" }).click();
  await expect(page.getByLabel("Código del programa").last()).toContainText("switch costume");
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByLabel("Código del programa").last()).not.toContainText("switch costume");
});

test("stage 2 can be completed from the keyboard and reports an incomplete reaction", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("button", { name: /Nivel avanzado/ }).click();
  await page.getByRole("button", { name: /\+ Cambiar disfraz/ }).click();
  await page.getByRole("button", { name: /\+ Tocar sonido/ }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await page.getByRole("button", { name: /Etapa 2/ }).click();
  const tap = page.getByRole("button", { name: "Tocar a Ori" });
  await tap.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("Todavía falta");
  const add = page.getByRole("button", { name: /\+ Cambiar disfraz/ });
  await add.focus();
  await page.keyboard.press("Enter");
  await tap.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("Reacción lograda");
});
