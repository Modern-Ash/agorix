import type { Page } from "@playwright/test";

/** Reload and land on the map, as these tests did before screens were restored on reload (#596). */
export async function reloadToMap(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.history.replaceState(null, "", "#/mapa");
  });
  await page.reload();
}
