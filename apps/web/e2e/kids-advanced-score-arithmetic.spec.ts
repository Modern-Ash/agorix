import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures.js";
import { reloadToMap } from "./helpers.js";

// Issue #465: arithmetic on the score, behind the advancedOps flag.
test.use({ hasTouch: true });

async function enterScore(page: import("@playwright/test").Page, flags: string[]) {
  await page.goto("/kids");
  await page.evaluate((flagList) => {
    localStorage.clear();
    localStorage.setItem("agorix.kids.flags.v1", JSON.stringify(flagList));
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
  }, flags);
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

test("the arithmetic blocks are absent while the flag is off", async ({ page }) => {
  await enterScore(page, []);
  await expect(page.getByRole("button", { name: /Sumar 1/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /al puntaje/ })).toHaveCount(0);
});

test("score 2, + 2, then - 5 shows 4 and -1 from the runtime", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await enterScore(page, ["advancedOps"]);
  await page.getByRole("button", { name: "+ Poner en 2" }).click();
  await page.getByRole("combobox", { name: "Cuánto" }).selectOption("2");
  await page.getByRole("button", { name: "+ Sumar 2 al puntaje" }).click();
  await page.getByRole("button", { name: "4", exact: true }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByRole("status", { name: "Puntaje: 4" })).toBeVisible();
  await expect(page.getByText(/Esperabas 4 y el puntaje mostró 4/)).toBeVisible();

  await page.getByRole("combobox", { name: "Cuánto" }).selectOption("5");
  await page.getByRole("button", { name: "+ Restar 5 al puntaje" }).click();
  await page.getByRole("button", { name: "-1", exact: true }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByRole("status", { name: "Puntaje: -1" })).toBeVisible();
  await expect(page.locator(".kids-code-strip")).toContainText(`("Puntaje" - 5)`);

  await page.getByRole("button", { name: "Deshacer" }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByRole("status", { name: "Puntaje: 4" })).toBeVisible();
  await reloadToMap(page);
  await expect(page.getByRole("button", { name: /Etapa 3/ })).toBeVisible();

  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter((item) => ["critical", "serious"].includes(item.impact ?? "")),
  ).toEqual([]);
});
