import { expect, test, type Page } from "@playwright/test";

// Issue #359: tablets and phones never clip primary controls and offer 44px touch targets.
// `hasTouch` makes `(pointer: coarse)` match, which is what a real tablet reports at 1180px.
test.use({ hasTouch: true });

const VIEWPORTS = [
  { name: "tablet landscape 1180x820", width: 1180, height: 820 },
  { name: "tablet landscape 1024x768", width: 1024, height: 768 },
  { name: "tablet portrait 820x1180", width: 820, height: 1180 },
  { name: "phone 390x844", width: 390, height: 844 },
] as const;

async function openFresh(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
  });
  await page.reload();
  await expect(page.locator(".learning-layout")).toBeVisible();
}

for (const viewport of VIEWPORTS) {
  test(`no clipped controls and 44px targets at ${viewport.name}`, async ({ page }) => {
    await openFresh(page, viewport.width, viewport.height);

    const report = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const controls = [
        ...document.querySelectorAll<HTMLElement>(
          'button, a[href], select, summary, input:not([type="checkbox"])',
        ),
      ].filter((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return box.width > 0 && box.height > 0 && style.visibility !== "hidden";
      });
      const label = (element: HTMLElement) =>
        (element.getAttribute("aria-label") ?? element.textContent ?? element.tagName)
          .trim()
          .slice(0, 32);
      return {
        offscreen: controls.filter((e) => e.getBoundingClientRect().right > width + 1).map(label),
        small: controls
          .filter((e) => {
            const box = e.getBoundingClientRect();
            return box.width < 44 || box.height < 44;
          })
          .map(
            (e) =>
              `${label(e)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`,
          ),
      };
    });

    expect(report.offscreen, "controls past the right edge").toEqual([]);
    expect(report.small, "controls under 44x44").toEqual([]);
  });
}

test("the fixed workbench scrolls the block palette so every block is reachable", async ({
  page,
}) => {
  await openFresh(page, 1180, 820);
  const palette = page.locator(".learning-layout > .action-palette");
  const box = await palette.boundingBox();
  await page.mouse.move(box!.x + 60, box!.y + box!.height - 60);
  for (let i = 0; i < 8; i += 1) await page.mouse.wheel(0, 500);

  const lastCategory = palette.locator(".scratch-category").last();
  await expect(lastCategory).toBeInViewport();
  const layoutBox = await page.locator(".learning-layout").boundingBox();
  const categoryBox = await lastCategory.boundingBox();
  expect(categoryBox!.y).toBeLessThan(layoutBox!.y + layoutBox!.height);
});

test("the mission card start button is not cut off in the workbench", async ({ page }) => {
  await openFresh(page, 1180, 820);
  const strip = page.locator(".mission-strip");
  const start = strip.locator(".primary-start");
  const stripBox = await strip.boundingBox();
  const startBox = await start.boundingBox();
  expect(startBox!.y + startBox!.height).toBeLessThanOrEqual(stripBox!.y + stripBox!.height + 1);
});

test("the stage panel and its controls fit inside a 1180px tablet", async ({ page }) => {
  await openFresh(page, 1180, 820);
  for (const name of [/Maximizar Escenario/, /Cerrar Escenario/, /Abrir código/]) {
    const control = page.getByRole("button", { name }).first();
    await expect(control).toBeInViewport({ ratio: 1 });
  }
});
