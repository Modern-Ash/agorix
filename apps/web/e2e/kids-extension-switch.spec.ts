import { expect, test, type Page } from "@playwright/test";
import { passAdultGate, reloadToMap } from "./helpers.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

// Issue #817: an adult can turn the pen and music packs off, and what was built stays.
async function start(page: Page) {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/kids");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  });
  await reloadToMap(page);
}

async function adultSwitch(page: Page, name: string) {
  await page.getByRole("button", { name: "Adultos" }).click();
  await passAdultGate(page);
  return page.getByRole("switch", { name: new RegExp(name) });
}

test("both packs are on for a new device and an adult can turn each off", async ({ page }) => {
  await start(page);
  const pen = await adultSwitch(page, "Paquete Lápiz");
  const music = page.getByRole("switch", { name: /Paquete Música/ });
  await expect(pen).toHaveAttribute("aria-checked", "true");
  await expect(music).toHaveAttribute("aria-checked", "true");
  await pen.click();
  await music.click();
  await expect(pen).toHaveAttribute("aria-checked", "false");
  await expect(music).toHaveAttribute("aria-checked", "false");
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  await expect(page.getByRole("group", { name: "Lápiz" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Música" })).toHaveCount(0);
  // Ori no longer offers music goals either.
  await expect(page.getByRole("button", { name: "Tocar una melodía" })).toHaveCount(0);
});

test("turned off, a scene already built with the packs keeps its blocks, and turning them on brings the panels back", async ({
  page,
}) => {
  await start(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  await page.getByRole("button", { name: "+ Bajar el lápiz" }).click();
  await page.getByRole("button", { name: "+ Tocar nota" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(2);
  await reloadToMap(page);
  const pen = await adultSwitch(page, "Paquete Lápiz");
  const music = page.getByRole("switch", { name: /Paquete Música/ });
  await pen.click();
  await music.click();
  await reloadToMap(page);
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(page.locator(".kids-program-block")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "+ Bajar el lápiz" })).toHaveCount(0);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("2 bloques ejecutados")).toBeVisible();
  await reloadToMap(page);
  await (await adultSwitch(page, "Paquete Lápiz")).click();
  await reloadToMap(page);
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(page.getByRole("button", { name: "+ Bajar el lápiz" })).toBeVisible();
});
