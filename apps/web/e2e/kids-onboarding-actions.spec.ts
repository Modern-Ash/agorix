import { expect, test } from "./fixtures.js";

const viewports = [
  { width: 390, height: 560 },
  { width: 1280, height: 600 },
];

for (const viewport of viewports) {
  test(`onboarding keeps its action buttons in view at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/kids");
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("agorix.locale", "es");
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: "¡Hola!" })).toBeVisible();

    const inView = async (name: string) => {
      const button = page.getByRole("button", { name, exact: true });
      await expect(button).toBeVisible();
      const box = (await button.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      expect(box.y).toBeGreaterThanOrEqual(0);
    };

    await inView("Seguir");
    await page.getByRole("button", { name: "Seguir", exact: true }).click();
    await inView("Seguir");
    await page.getByRole("button", { name: "Seguir", exact: true }).click();
    await inView("¡Empezar!");
  });
}
