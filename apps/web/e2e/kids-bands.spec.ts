import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures.js";
import { passAdultGate, reloadToMap, openAdultTab } from "./helpers.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

const BANDS = [
  { band: "6-8", fontPx: 18, target: 56, solutionStep: true, studioBlocks: 6 },
  { band: "9-12", fontPx: 16, target: 48, solutionStep: true, studioBlocks: 8 },
  { band: "13+", fontPx: 15, target: 44, solutionStep: false, studioBlocks: 8 },
] as const;

async function seed(page: Page, settings: object | null) {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/kids");
  await page.evaluate((adults) => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
    if (adults) localStorage.setItem("agorix.kids.adults.v1", JSON.stringify(adults));
  }, settings);
  await reloadToMap(page);
}

for (const profile of BANDS) {
  test(`the ${profile.band} band changes text, targets, hints and Ori's idea size`, async ({
    page,
  }) => {
    await seed(page, {
      oriSuggestions: true,
      readAloud: false,
      dailyLimitMinutes: 30,
      ageBand: profile.band,
      bandChosen: true,
    });
    // Text size follows the band for the whole Kids area.
    await expect
      .poll(() =>
        page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize)),
      )
      .toBeCloseTo(profile.fontPx, 1);
    // Touch targets follow it too, and none is under the 44 px floor.
    await page.getByRole("button", { name: "Misión 1" }).click();
    const run = await page.getByRole("button", { name: "Jugar", exact: true }).boundingBox();
    expect(run!.height).toBeGreaterThanOrEqual(profile.target - 1);
    // The hint ladder reaches the idea itself only in the younger bands.
    for (const level of [1, 2, 3, 4]) {
      await page.getByRole("button", { name: `Pista ${level}`, exact: true }).click();
    }
    await expect(page.getByRole("button", { name: "Ver idea" })).toHaveCount(
      profile.solutionStep ? 1 : 0,
    );
    // Ori's goals in the Studio: the younger band gets shorter ideas.
    await page.getByRole("button", { name: "Volver al mapa" }).click();
    await page.getByRole("button", { name: "Crear", exact: true }).click();
    await page.getByRole("button", { name: "Crear escena" }).click();
    const picker = page.getByRole("group", { name: "¿Qué querés lograr?" });
    await expect(picker.getByRole("button")).toHaveCount(profile.studioBlocks === 6 ? 5 : 7);
    await expect(picker.getByRole("button", { name: "Hacer un cuadrado" })).toHaveCount(
      profile.studioBlocks === 6 ? 0 : 1,
    );
  });
}

test("a new device asks an adult for the band, keeps only the category, and sets the voice default", async ({
  page,
}) => {
  await seed(page, null);
  const ask = page.getByRole("note").filter({ hasText: "elegir la franja" });
  await expect(ask).toContainText("No pedimos fecha de nacimiento");
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await ask.getByRole("button", { name: "Elegir la franja de edad" }).click();
  await passAdultGate(page);
  await openAdultTab(page, "Ajustes");
  // No birth date field anywhere, only the three categories.
  await expect(page.locator('input[type="date"]')).toHaveCount(0);
  await expect(page.getByRole("radio")).toHaveCount(3);
  await page.getByRole("radio", { name: "13–" }).or(page.getByLabel("13+")).first().check();
  const stored = await page.evaluate(() => localStorage.getItem("agorix.kids.adults.v1"));
  expect(JSON.parse(stored!)).toMatchObject({
    ageBand: "13+",
    bandChosen: true,
    readAloud: false,
  });
  expect(stored).not.toMatch(/birth|nacimiento|\d{4}-\d{2}-\d{2}/i);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await expect(page.getByRole("note").filter({ hasText: "elegir la franja" })).toHaveCount(0);
});

test("an adult who keeps the default band confirms it once", async ({ page }) => {
  await seed(page, null);
  await page.getByRole("button", { name: "Elegir la franja de edad" }).click();
  await passAdultGate(page);
  await openAdultTab(page, "Ajustes");
  await page.getByRole("button", { name: "Seguir con 6–8" }).click();
  const stored = JSON.parse(
    (await page.evaluate(() => localStorage.getItem("agorix.kids.adults.v1")))!,
  );
  expect(stored).toMatchObject({ ageBand: "6-8", bandChosen: true, readAloud: true });
  await expect(page.getByRole("button", { name: "Seguir con 6–8" })).toHaveCount(0);
});
