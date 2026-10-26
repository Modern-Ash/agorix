import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { reloadToMap } from "./helpers.js";

test.use({ hasTouch: true });

async function enterScore(page: import("@playwright/test").Page) {
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
  await expect(page.getByRole("button", { name: /Etapa 3/ })).toHaveCount(0);
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

test("stage 3 shows runtime watcher truth, prediction and saved progress", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await enterScore(page);
  await expect(page.getByRole("heading", { name: "Llevá la cuenta" })).toBeVisible();
  await expect(page.getByRole("status", { name: "Puntaje: 0" })).toBeVisible();
  await page.getByRole("button", { name: "+ Sumar 1" }).click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByRole("status", { name: "Puntaje: 1" })).toBeVisible();
  await expect(page.getByRole("status").last()).toContainText("Puntaje logrado");
  await expect(page.getByText(/Esperabas 1 y el puntaje mostró 1/)).toBeVisible();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter((item) => ["critical", "serious"].includes(item.impact ?? "")),
  ).toEqual([]);
  await reloadToMap(page);
  await page.getByRole("button", { name: /Etapa 3/ }).click();
  await expect(page.getByRole("status").last()).toContainText("Puntaje logrado");
  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await expect(page.getByRole("button", { name: /Nivel avanzado/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Etapa 2/ })).toBeVisible();
});

test("stage 3 works from keyboard and Ori remains a reviewable fallback", async ({ page }) => {
  await enterScore(page);
  const play = page.getByRole("button", { name: "Jugar" });
  await play.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").last()).toContainText("todavía no cambió");
  await page.getByRole("button", { name: "Pedirle una idea a Ori" }).click();
  const review = page.getByLabel("Ori propone agregar");
  await expect(review).toContainText("Sumar 1");
  await expect(page.getByLabel("Código del programa").last()).not.toContainText("change score");
  await review.getByRole("button", { name: "No usar" }).click();
  await page.getByRole("button", { name: "Pedirle una idea a Ori" }).click();
  await review.getByRole("button", { name: "Agregar bloque" }).click();
  await play.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").last()).toContainText("Puntaje logrado");
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByLabel("Código del programa").last()).not.toContainText("change score");
});

test("score blocks and the watcher survive tablet rotation without drifting", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await enterScore(page);
  await page.getByRole("button", { name: "+ Sumar 1" }).click();
  await page.setViewportSize({ width: 1180, height: 820 });
  await expect(page.getByRole("button", { name: "+ Sumar 1" })).toBeVisible();
  await expect(page.getByRole("status", { name: "Puntaje: 0" })).toBeVisible();
  await page.getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByRole("status", { name: "Puntaje: 1" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
