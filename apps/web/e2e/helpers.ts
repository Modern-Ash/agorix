import type { Page } from "@playwright/test";

/**
 * Reload and land on a given screen. The address is set before the reload, so the app reads it when
 * it starts; setting it after a reload races with the app mounting and was flaky (#596).
 */
export async function reloadTo(page: Page, hash: string): Promise<void> {
  await page.evaluate((target) => {
    window.history.replaceState(null, "", target);
  }, hash);
  await page.reload();
}

/** Reload and land on the map, as these tests did before screens were restored on reload (#596). */
export async function reloadToMap(page: Page): Promise<void> {
  await reloadTo(page, "#/mapa");
}

/**
 * Get through the grown-ups gate as an adult would: solve the fresh calculation to start a PIN,
 * choose one, repeat it, or just enter it when one exists (issue #599).
 */
export async function passAdultGate(page: Page, pin = "4829"): Promise<void> {
  const title = page.locator("#kids-parents-title");
  const press = async (digits: string) => {
    for (const digit of digits)
      await page.getByRole("button", { name: digit, exact: true }).click();
    await page.getByRole("button", { name: /^(Comprobar|Check)$/ }).click();
  };
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const heading = ((await title.textContent()) ?? "").trim();
    const sum = /(\d+) × (\d+)/.exec(heading);
    if (sum) await press(String(Number(sum[1]) * Number(sum[2])));
    else if (/PIN/.test(heading)) await press(pin);
    else return;
    // Wait for the next step (the PIN is hashed on this device, which takes a moment).
    await page
      .waitForFunction(
        (before) => document.querySelector("#kids-parents-title")?.textContent?.trim() !== before,
        heading,
        { timeout: 10_000 },
      )
      .catch(() => undefined);
  }
}
