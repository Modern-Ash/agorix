import { expect, test } from "./fixtures.js";

async function openMission(page: import("@playwright/test").Page) {
  await page.setViewportSize({ width: 1280, height: 900 });
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
}

test("the code and selected-sprite panels resize from a divider and keep a floor (#1206)", async ({
  page,
}) => {
  await openMission(page);
  for (const [name, selector] of [
    ["Código", ".kids-studio-code-panel .agx-panel-body"],
    ["Objeto seleccionado", ".kids-studio-inspector-panel .agx-panel-body"],
  ] as const) {
    const divider = page.getByRole("separator", { name: new RegExp(name) });
    await expect(divider).toBeVisible();
    const body = page.locator(selector);
    await divider.focus();
    for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowUp");
    await expect.poll(async () => (await body.boundingBox())!.height).toBeGreaterThan(160);
    const grown = (await body.boundingBox())!.height;
    for (let i = 0; i < 80; i++) await page.keyboard.press("ArrowDown");
    const shrunk = (await body.boundingBox())!.height;
    expect(shrunk).toBeLessThan(grown);
    expect(shrunk).toBeGreaterThanOrEqual(119);
  }
});

test("a resized panel keeps its size after reopening (#1206)", async ({ page }) => {
  await openMission(page);
  const divider = page.getByRole("separator", { name: /Código/ });
  await divider.focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowUp");
  const body = page.locator(".kids-studio-code-panel .agx-panel-body");
  const before = (await body.boundingBox())!.height;
  await page.reload();
  await expect
    .poll(async () => Math.abs((await body.boundingBox())!.height - before))
    .toBeLessThan(2);
});
