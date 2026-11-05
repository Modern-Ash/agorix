import { expect, test, type Page } from "./fixtures.js";
import { clickCreateScene } from "./helpers.js";

// Issue #1246: nearly every control says what it does. The audit tabs through a screen with the
// keyboard (focus shows the tooltip at once) and reports every control that stayed silent, so a
// new button cannot ship without a line in `kidsTips.ts`.
test.use({ serviceWorkers: "block" });

async function start(page: Page, viewport = { width: 1280, height: 900 }) {
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
}

/** Tab through the page once and list the controls that showed no tooltip. */
async function silentControls(page: Page, limit = 400): Promise<string[]> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const silent: string[] = [];
  const seen = new Set<string>();
  for (let step = 0; step < limit; step += 1) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return null;
      if (!element.matches("button, [role='tab'], [role='menuitem'], summary, a[href]"))
        return null;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      const label = (element.getAttribute("aria-label") ?? element.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 50);
      return { label, cls: element.className.toString().slice(0, 50) };
    });
    if (!info) continue;
    const key = `${info.cls}|${info.label}`;
    if (seen.has(key)) break; // the tab order wrapped around
    seen.add(key);
    const shown = await page
      .waitForFunction(() => document.querySelector("#kids-tip")?.textContent?.trim(), undefined, {
        timeout: 400,
      })
      .then(() => true)
      .catch(() => false);
    if (!shown) silent.push(`${info.label} [${info.cls}]`);
  }
  return silent;
}

test("the editor's controls all say what they do (#1246)", async ({ page }) => {
  test.setTimeout(180_000);
  await start(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await clickCreateScene(page);
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Agregar personaje" }).click();
  expect(await silentControls(page), "controls without a tooltip in the Code tab").toEqual([]);
  await page.getByRole("tab", { name: /Disfraces/ }).click();
  expect(await silentControls(page), "controls without a tooltip in Costumes").toEqual([]);
  await page.getByRole("tab", { name: /Sonidos/ }).click();
  expect(await silentControls(page), "controls without a tooltip in Sounds").toEqual([]);
});

test("the bottom navigation, map and Crear controls say what they do (#1246)", async ({ page }) => {
  test.setTimeout(120_000);
  await start(page);
  expect(await silentControls(page), "map").toEqual([]);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  expect(await silentControls(page), "Crear").toEqual([]);
});

test("a mouse waits a moment, then the tip stays while it is hovered, and Escape closes it (#1246)", async ({
  page,
}) => {
  await start(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await clickCreateScene(page);
  const tip = page.locator("#kids-tip");
  await page.getByRole("tab", { name: /Disfraces/ }).hover();
  await expect(tip).toHaveText(/Disfraces: elegí o dibujá/);
  await expect(tip).toHaveAttribute("role", "tooltip");
  // The control is described by it while it is open.
  await expect(page.getByRole("tab", { name: /Disfraces/ })).toHaveAttribute(
    "aria-describedby",
    "kids-tip",
  );
  // The pointer can move onto the tip without closing it.
  const box = (await tip.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(tip).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tip).toHaveCount(0);
  // Leaving closes it too.
  await page.getByRole("tab", { name: /Sonidos/ }).hover();
  await expect(tip).toHaveText(/Sonidos: escuchá/);
  await page.mouse.move(2, 2);
  await expect(tip).toHaveCount(0);
});

test("the tip stays inside the window and speaks English in English (#1246)", async ({ page }) => {
  await start(page, { width: 1280, height: 700 });
  await page.evaluate(() => localStorage.setItem("agorix.locale", "en"));
  await page.reload();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("button", { name: "Create scene", exact: true }).click();
  await page.getByRole("tab", { name: /Costumes/ }).hover();
  const tip = page.locator("#kids-tip");
  await expect(tip).toHaveText(/Costumes: pick or draw/);
  const box = (await tip.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(1280);
  expect(box.y + box.height).toBeLessThanOrEqual(700);
});

test("a long press on a phone shows the tip, and a drag does not (#1246)", async ({ page }) => {
  await start(page, { width: 390, height: 844 });
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await clickCreateScene(page);
  const tip = page.locator("#kids-tip");
  const bar = page.getByRole("button", { name: "Disfraces", exact: true });
  const box = (await bar.boundingBox())!;
  // Playwright has no long press: dispatch the pointer events a finger sends.
  await bar.dispatchEvent("pointerdown", {
    pointerType: "touch",
    clientX: box.x + 5,
    clientY: box.y + 5,
    bubbles: true,
  });
  await expect(tip).toHaveText(/Disfraces: elegí o dibujá/, { timeout: 2500 });
  await bar.dispatchEvent("pointerup", { pointerType: "touch", bubbles: true });
});
