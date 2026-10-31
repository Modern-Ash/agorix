import { expect, test } from "@playwright/test";

test.use({ hasTouch: true, serviceWorkers: "block" });

// Issue #1121: both free creation paths open from a fresh onboarded profile with no mission done,
// without touching the map or the progression.
const PROGRESS = { onboarded: true, avatar: "🐸", stars: 0, done: {} };

test("free scene and free project open without finishing a mission and leave progress intact", async ({
  page,
}) => {
  await page.goto("/kids");
  await page.evaluate((progress) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem("agorix.kids.progress.v1", JSON.stringify(progress));
  }, PROGRESS);
  await page.reload();

  // Escena libre = the Studio: whole categorized palette, never the mission subset.
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  await expect(page).toHaveURL(/#\/escena\//);
  await expect
    .poll(() => page.locator(".kids-studio-palette [data-kids-palette-tool]").count())
    .toBeGreaterThan(15);

  // ¡Crear! = a free project in the single-character editor.
  await page.getByRole("button", { name: "Volver a Crear" }).click();
  await page.getByRole("button", { name: "¡Crear!" }).click();
  await expect(page).toHaveURL(/#\/libre\//);
  await expect(page.getByRole("button", { name: "Jugar", exact: true })).toBeVisible();

  // The map and its first mission are still there and still locked to the learner's progress.
  await page.getByRole("button", { name: "Mapa" }).click();
  await expect(page.getByRole("heading", { name: "Mapa" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Misión 1" })).toBeVisible();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("agorix.kids.progress.v1") ?? "{}")),
  ).toMatchObject({ stars: 0, done: {} });
});

for (const [name, viewport] of [
  ["desktop", { width: 1280, height: 800 }],
  ["tablet", { width: 820, height: 1180 }],
  ["mobile", { width: 390, height: 844 }],
] as const) {
  test(`the create deep link reaches both free paths on ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/kids");
    await page.evaluate((progress) => {
      localStorage.clear();
      localStorage.setItem("agorix.locale", "es");
      localStorage.setItem("agorix.kids.progress.v1", JSON.stringify(progress));
    }, PROGRESS);
    await page.goto("/kids#/crear");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Escena libre", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear escena" })).toBeVisible();
    await expect(page.getByRole("button", { name: "¡Crear!" })).toBeVisible();
  });
}
