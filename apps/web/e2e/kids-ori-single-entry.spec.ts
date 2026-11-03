import { expect, test } from "./fixtures.js";

const seed = {
  onboarded: true,
  avatar: "🐸",
  stars: 0,
  done: {},
};

for (const [name, viewport] of [
  ["desktop", { width: 1280, height: 800 }],
  ["phone", { width: 390, height: 844 }],
] as const) {
  test(`a mission offers one way in to Ori on ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/kids");
    await page.evaluate((progress) => {
      localStorage.clear();
      localStorage.setItem("agorix.locale", "es");
      localStorage.setItem("agorix.kids.progress.v1", JSON.stringify(progress));
    }, seed);
    await page.reload();
    await page.getByRole("button", { name: "Misión 1" }).click();
    await expect(page.getByRole("heading", { name: "Camino recto" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^(Mostrar ayuda de Ori|Abrir Ori)$/ }),
    ).toHaveCount(1);
  });
}
