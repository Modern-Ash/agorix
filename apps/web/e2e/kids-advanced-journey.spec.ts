import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.use({ hasTouch: true, serviceWorkers: "block" });

async function addMove(page: Page, index: number, cells: number) {
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  await page.getByRole("combobox", { name: `mover ${index}` }).selectOption(String(cells));
}

async function runMission(page: Page) {
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sí", exact: true }).click();
  await expect(page.locator(".kids-run-status")).toContainText("Llegaste");
  await page.getByRole("button", { name: "Volver al mapa" }).click();
}

test("Spanish tablet journey completes authored missions and all advanced stages", async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/kids");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({
        onboarded: true,
        avatar: "🦊",
        stars: 0,
        done: {},
      }),
    );
  });
  await page.reload();
  await expect(page.getByRole("button", { name: /Nivel avanzado/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Misión 1" }).click();
  await addMove(page, 1, 4);
  await runMission(page);
  await page.getByRole("button", { name: "Misión 2" }).click();
  await addMove(page, 1, 3);
  await page.getByRole("button", { name: "+ girar ←" }).click();
  await addMove(page, 3, 2);
  await runMission(page);
  await page.getByRole("button", { name: "Misión 3" }).click();
  await page.getByRole("button", { name: "+ girar →" }).click();
  await addMove(page, 2, 3);
  await page.getByRole("button", { name: "+ girar ←" }).click();
  await addMove(page, 4, 3);
  await runMission(page);

  await expect(page.getByRole("button", { name: /Nivel avanzado/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Etapa 2/ })).toHaveCount(0);
  await page.getByRole("button", { name: /Nivel avanzado/ }).click();
  await page.getByRole("button", { name: /\+ Cambiar disfraz/ }).click();
  await page.getByRole("button", { name: /\+ Tocar sonido/ }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByRole("status")).toContainText("Escena lograda");
  await expect(page.getByLabel("Código del programa").last()).toContainText("switch costume");
  await page.getByRole("button", { name: "Python" }).click();
  await expect(page.getByLabel("Código del programa").last()).toContainText("switch_costume");
  await page.getByRole("button", { name: "TypeScript" }).click();
  await expect(page.getByLabel("Código del programa").last()).toContainText("switchCostume");
  await page.getByRole("button", { name: "Volver al mapa" }).click();

  await page.getByRole("button", { name: /Etapa 2/ }).click();
  await expect(page.getByLabel("Código del programa").last()).toContainText("when actor clicked");
  await page.getByRole("button", { name: /\+ Cambiar disfraz/ }).click();
  await page.getByRole("button", { name: "Tocar a Ori" }).click();
  await expect(page.getByRole("status")).toContainText("Reacción lograda");
  await page.getByRole("button", { name: "Python" }).click();
  await expect(page.getByLabel("Código del programa").last()).toContainText("actor_clicked");
  await page.getByRole("button", { name: "TypeScript" }).click();
  await expect(page.getByLabel("Código del programa").last()).toContainText("whenActorClicked");
  await page.getByRole("button", { name: "Volver al mapa" }).click();

  await page.getByRole("button", { name: /Etapa 3/ }).click();
  await page.getByRole("button", { name: "+ Sumar 1" }).click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByRole("status", { name: "Puntaje: 1" })).toBeVisible();
  await expect(page.getByRole("status").last()).toContainText("Puntaje logrado");
  await page.getByRole("button", { name: "Python" }).click();
  await expect(page.getByLabel("Código del programa").last()).toContainText("puntaje += 1");
  await page.getByRole("button", { name: "TypeScript" }).click();
  await expect(page.getByLabel("Código del programa").last()).toContainText("puntaje");
  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter((item) => ["critical", "serious"].includes(item.impact ?? "")),
  ).toEqual([]);
  await page.reload();
  await expect(page.getByRole("button", { name: /Etapa 3/ })).toBeVisible();
  await page.getByRole("button", { name: /Etapa 3/ }).click();
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.context().setOffline(true);
  const savedProgram = await page.evaluate(
    () => JSON.parse(localStorage.getItem("agorix:kids.advanced.score") ?? "null")?.program,
  );
  await page.getByRole("button", { name: "Pedirle una idea a Ori" }).click();
  const review = page.getByLabel("Ori propone agregar");
  await expect(review).toBeVisible();
  await review.getByRole("button", { name: "No usar" }).click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("agorix:kids.advanced.score") ?? "null")?.program,
    ),
  ).toEqual(savedProgram);
  await page.getByRole("button", { name: "Pedirle una idea a Ori" }).click();
  await review.getByRole("button", { name: "Agregar bloque" }).click();
  await page.getByRole("button", { name: "Deshacer" }).click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("agorix:kids.advanced.score") ?? "null")?.program,
    ),
  ).toEqual(savedProgram);
  await page.getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByRole("status", { name: "Puntaje: 1" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
