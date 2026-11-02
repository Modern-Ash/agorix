import { expect, test } from "./fixtures.js";
import { reloadToMap } from "./helpers.js";

// Issue #1190: the Studio panel maximize now runs on the shared panel layout reducer.
const WIDTHS = [
  { width: 360, height: 740 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
] as const;

for (const { width, height } of WIDTHS) {
  test(`Studio has no horizontal scroll at ${width}px, also with a panel maximized`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/advanced");
    const overflows = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
    expect(await overflows()).toBe(false);

    const maximize = page.getByRole("button", { name: /^(Maximize|Maximizar) /i }).first();
    await maximize.click();
    await expect(page.locator(".panel-maximized")).toHaveCount(1);
    expect(await overflows()).toBe(false);

    await page
      .getByRole("button", { name: /^(Restore|Restaurar) /i })
      .first()
      .click();
    await expect(page.locator(".panel-maximized")).toHaveCount(0);
    expect(await overflows()).toBe(false);
  });
}

// Issue #1191 (2a): one-line top bar with a mission pill; the big mission card is gone.
for (const { width, height } of WIDTHS) {
  test(`mission editor top bar fits at ${width}px and the pill opens the full goal`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
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
    await page.getByRole("button", { name: "Misión 1" }).click();
    const pill = page.locator(".kids-mission-pill");
    await expect(pill).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(".kids-mission-studio-intro")).toBeHidden();
    const header = await page.locator(".kids-studio-header").boundingBox();
    // One line from tablet up; on a phone the pill takes a second row.
    expect(header!.height).toBeLessThanOrEqual(width < 768 ? 120 : 64);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      ),
    ).toBe(false);

    await pill.click();
    await expect(pill).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".kids-mission-studio-intro")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".kids-mission-studio-intro")).toBeHidden();
  });
}

// Issue #1191 (2b): Costumes and Sounds open in the left drawer; program and stage stay visible.
for (const { width, height } of WIDTHS.filter((size) => size.width >= 768)) {
  test(`Costumes and Sounds keep the program and stage visible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
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
    await page.getByRole("button", { name: "Misión 1" }).click();
    for (const tab of ["Disfraces", "Sonidos"]) {
      await page.getByRole("tab", { name: new RegExp(tab) }).click();
      await expect(page.locator(".kids-studio-media-panel")).toBeVisible();
      await expect(page.locator(".kids-program-zone").first()).toBeVisible();
      await expect(page.locator(".kids-studio-stage").first()).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        ),
      ).toBe(false);
    }
    if (width >= 900) {
      const drawer = await page.locator(".kids-studio-media-panel").boundingBox();
      const program = await page.locator(".kids-program-zone").first().boundingBox();
      expect(drawer!.x + drawer!.width).toBeLessThanOrEqual(program!.x + 1);
    }
    await page.getByRole("tab", { name: /Código/ }).click();
    await expect(page.locator(".kids-studio-media-panel")).toHaveCount(0);
  });
}
