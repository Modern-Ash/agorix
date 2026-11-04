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

test("the code panel resizes from a divider and keep a floor (#1206)", async ({ page }) => {
  await openMission(page);
  for (const [name, selector] of [["Código", ".kids-studio-code-panel .agx-panel-body"]] as const) {
    const divider = page.getByRole("separator", { name: new RegExp(name) });
    await expect(divider).toBeVisible();
    const body = page.locator(selector);
    const height = async () => (await body.boundingBox())!.height;
    const initial = await height();
    await divider.focus();
    for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowUp");
    // Growing is capped by the panel's own maximum, so only the change is asserted here.
    await expect.poll(async () => Math.abs((await height()) - initial)).toBeGreaterThan(20);
    for (let i = 0; i < 80; i++) await page.keyboard.press("ArrowDown");
    // It settles on the floor, never below it.
    await expect.poll(height).toBeLessThanOrEqual(125);
    expect(await height()).toBeGreaterThanOrEqual(119);
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
