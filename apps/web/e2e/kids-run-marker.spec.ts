import { expect, test } from "./fixtures.js";
import { clickCreateScene } from "./helpers.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

test("Ori notices a condition that never held, and points at its block", async ({ page }) => {
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
  await clickCreateScene(page);
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Si el ratón está pulsado, mover 1" }).click();
  // Nothing is said while the program runs or before it has run.
  await expect(page.locator(".kids-ori-noticed")).toHaveCount(0);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  const marker = page.getByRole("button", { name: /Ori vio algo/ });
  await expect(marker).toBeVisible();
  await marker.click();
  await expect(page.locator(".kids-ori-noticed-panel")).toContainText("dijo que no");
  await page.getByRole("button", { name: "Ver en el programa" }).click();
  await expect(page.locator('.kids-program-block[data-finding="true"]')).toHaveCount(1);
  await expect(page.locator('.kids-program-block[data-finding="true"]')).toContainText(
    "Si ratón pulsado",
  );
});

test("nothing is noticed in a run that did what it said", async ({ page }) => {
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
  await clickCreateScene(page);
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Paso", exact: true })).toBeEnabled();
  await expect(page.locator(".kids-ori-noticed")).toHaveCount(0);
});

test("Ori offers the message that is missing, shows the block, and only adds it when accepted", async ({
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
  await clickCreateScene(page);
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Agregar personaje" }).click();
  await page.getByRole("combobox", { name: "Cuando" }).selectOption("onMessage");
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("button", { name: /Ori vio algo/ }).click();
  await expect(page.locator(".kids-ori-noticed-panel")).toContainText("nadie lo manda");
  const diff = page.getByTestId("ori-fix-diff");
  await expect(diff).toContainText("Enviar mensaje");
  // Nothing was added yet: the first character still has only its move.
  await page.getByRole("group", { name: "Personajes" }).getByRole("button").first().click();
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
  await page.getByRole("group", { name: "Personajes" }).getByRole("button").last().click();
  await page.getByRole("button", { name: /Ori vio algo/ }).click();
  await page.getByRole("button", { name: "Usar este cambio" }).click();
  await page.getByRole("group", { name: "Personajes" }).getByRole("button").first().click();
  await expect(page.locator(".kids-program-block")).toHaveCount(2);
  await expect(page.locator(".kids-program-block").last()).toContainText("Enviar mensaje");
});
