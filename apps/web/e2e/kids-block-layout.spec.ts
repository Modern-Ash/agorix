import { expect, test } from "./fixtures.js";

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`block controls never cover the block text at ${viewport.width}px (#1205)`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
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
    await page.getByRole("button", { name: "Misión 1" }).click();
    await page.getByRole("button", { name: "★ Girar a la derecha" }).click();

    const block = page.locator(".kids-studio-program-column .kids-program-block").first();
    await expect(block).toBeVisible();
    const label = (await block.locator(".kids-block-handle + span").boundingBox())!;
    const controls = await block.locator("> .kids-button").all();
    expect(controls.length).toBeGreaterThanOrEqual(4);
    for (const control of controls) {
      const box = (await control.boundingBox())!;
      const apart =
        box.x >= label.x + label.width ||
        box.x + box.width <= label.x ||
        box.y >= label.y + label.height ||
        box.y + box.height <= label.y;
      expect(apart).toBe(true);
    }
  });
}

test("the block categories stay folded until Code is tapped on desktop (#1205)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
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
  await page.getByRole("button", { name: "Misión 1" }).click();
  const nav = page.getByRole("navigation", { name: "Categorías de bloques" });
  const code = page.getByRole("tab", { name: /Código/ });
  await expect(code).toBeVisible();
  await expect(nav).toBeHidden();
  await code.click();
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("button", { name: "Movimiento" })).toBeVisible();
  await page.getByRole("tab", { name: /Disfraces/ }).click();
  await expect(nav).toBeHidden();
});
