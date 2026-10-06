import { expect, test, type Page } from "@playwright/test";

/**
 * Scratch-parity journey: what a learner who knows Scratch expects to do in the first minutes.
 * Agorix directions follow the runtime convention (0° faces east, x grows to the right).
 */
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    localStorage.clear();
    for (const registration of await navigator.serviceWorker.getRegistrations()) {
      await registration.unregister();
    }
    for (const key of await caches.keys()) {
      await caches.delete(key);
    }
  });
  await page.reload();
  await page.setViewportSize({ width: 1280, height: 800 });
});

const sprite = (page: Page) => page.getByTestId("stage-sprite");
const num = async (page: Page, attr: string) => Number(await sprite(page).getAttribute(attr));
const run = (page: Page) => page.getByRole("button", { name: "Run", exact: true }).first();
const palette = (page: Page, name: string) =>
  page.locator(".action-palette").getByRole("button", { name, exact: true });

test("the stage greets the learner with an animated character, not a placeholder shape", async ({
  page,
}) => {
  await expect(page.getByTestId("pico-art")).toBeVisible();
  await expect(sprite(page)).toHaveAttribute("data-visible", "true");
  await expect(page.getByTestId("actor-chip")).toContainText("Sprite");
  await expect(run(page)).toBeEnabled();
});

test("click a Move block, press Run: the sprite moves by exactly that many steps", async ({
  page,
}) => {
  const startX = await num(page, "data-x");
  await palette(page, "Move").click();
  await run(page).click();
  await expect.poll(() => num(page, "data-x")).toBe(startX + 10);
});

test("Turn rotates the sprite", async ({ page }) => {
  const startHeading = await num(page, "data-heading");
  await palette(page, "Turn").click();
  await run(page).click();
  await expect.poll(() => num(page, "data-heading")).toBe((startHeading + 90) % 360);
});

test("Repeat 3 with a Move inside travels three times as far", async ({ page }) => {
  const startX = await num(page, "data-x");
  await palette(page, "Repeat").click();
  await page.locator(".tool-motion_move").dragTo(page.locator(".nested-block-stack"));
  await run(page).click();
  await expect.poll(() => num(page, "data-x")).toBe(startX + 30);
});

test("the character walks: legs swap pose on every executed step, then rest", async ({ page }) => {
  await palette(page, "Move").click();
  await palette(page, "Move").click();
  await expect(page.getByTestId("pico-art")).toHaveAttribute("data-frame", "0");
  const seen = new Set<string>();
  await page.getByRole("button", { name: "Step", exact: true }).click();
  for (let i = 0; i < 6; i += 1) {
    seen.add((await page.getByTestId("pico-art").getAttribute("data-frame")) ?? "");
    const next = page.getByRole("button", { name: "Step", exact: true });
    if (await next.isDisabled()) break;
    await next.click();
  }
  expect(seen.has("0") && seen.has("1")).toBe(true);
});

test("reduced motion keeps the character still while the blocks still run", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await palette(page, "Move").click();
  await palette(page, "Move").click();
  const startX = await num(page, "data-x");
  await run(page).click();
  await expect.poll(() => num(page, "data-x")).toBe(startX + 20);
  await expect(page.getByTestId("pico-art")).toHaveAttribute("data-frame", "0");
});

test("Reset puts the sprite back where it started", async ({ page }) => {
  const startX = await num(page, "data-x");
  await palette(page, "Move").click();
  await run(page).click();
  await expect.poll(() => num(page, "data-x")).toBe(startX + 10);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect.poll(() => num(page, "data-x")).toBe(startX);
});

test("the sprite pane edits the sprite live and can switch the look", async ({ page }) => {
  await page.getByTestId("actor-x").fill("77");
  await expect(sprite(page)).toHaveAttribute("data-x", "77");
  await page.getByRole("tab", { name: "Costumes" }).click();
  await page.getByTestId("costume-cat").click();
  await expect(page.getByTestId("pico-art")).toHaveCount(0);
  await page.getByTestId("costume-pico").click();
  await expect(page.getByTestId("pico-art")).toBeVisible();
});

test("the project survives a reload and runs the same program the same way", async ({ page }) => {
  await palette(page, "Move").click();
  await palette(page, "Turn").click();
  const outcome = async () => {
    await run(page).click();
    await expect.poll(async () => (await num(page, "data-heading")) > 0).toBe(true);
    return [await num(page, "data-x"), await num(page, "data-y"), await num(page, "data-heading")];
  };
  const first = await outcome();
  await page.reload();
  expect(await outcome()).toEqual(first);
});
