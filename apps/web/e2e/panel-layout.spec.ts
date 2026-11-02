import { expect, test } from "./fixtures.js";

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
