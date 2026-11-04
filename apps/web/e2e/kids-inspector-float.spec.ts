import { expect, test, type Page } from "./fixtures.js";
import { clickCreateScene } from "./helpers.js";

// Issue #1231: the "Objeto seleccionado" panel is a floating card, open on demand. Selecting a
// character shows a round button; the card opens only when the button is tapped.
test.use({ serviceWorkers: "block" });

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
] as const;

async function freeScene(page: Page, viewport: { width: number; height: number }) {
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
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await clickCreateScene(page);
}

const fab = (page: Page) => page.getByRole("button", { name: /^Objeto seleccionado: / });
const card = (page: Page) => page.getByLabel("Objeto seleccionado", { exact: true });

for (const viewport of VIEWPORTS) {
  test(`the selected sprite floats and opens on demand at ${viewport.name}`, async ({ page }) => {
    await freeScene(page, viewport);

    // 1. Nothing selected: no button and no panel.
    await expect(fab(page)).toHaveCount(0);
    await expect(card(page)).toHaveCount(0);

    // 2. Selecting a character shows only the round 56 px button, with its initial.
    await page.locator(".kids-studio-stage-actor").first().click();
    await expect(fab(page)).toBeVisible();
    await expect(card(page)).toHaveCount(0);
    const round = (await fab(page).boundingBox())!;
    expect(Math.round(round.width)).toBe(56);
    expect(Math.round(round.height)).toBe(56);
    await expect(fab(page)).toHaveText("N");
    // It is in the lower right and does not sit on Ori's button.
    expect(round.x + round.width).toBeGreaterThan(viewport.width - 24);
    const ori = page.locator(".kids-ori-float-trigger").last();
    if (await ori.isVisible()) {
      const oriBox = (await ori.boundingBox())!;
      const apart =
        round.y + round.height <= oriBox.y ||
        round.x + round.width <= oriBox.x ||
        round.x >= oriBox.x + oriBox.width;
      expect(apart).toBe(true);
    }

    // 3. Tapping it opens the card: 8 px margin, 18 px corners, at most 48vh, scrolls inside.
    await fab(page).click();
    await expect(card(page)).toBeVisible();
    const box = (await card(page).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(7);
    expect(box.height).toBeLessThanOrEqual(viewport.height * 0.48 + 1);
    expect(viewport.height - (box.y + box.height)).toBeGreaterThanOrEqual(7);
    await expect(card(page)).toHaveCSS("border-top-left-radius", "18px");
    await expect(card(page).locator(".kids-inspector-body")).toHaveCSS("overflow-y", "auto");

    // 4. Header: the label and "Nombre · x · y" do not overlap, on one line; close is 40 px.
    const label = (await card(page).locator(".kids-inspector-title small").boundingBox())!;
    const title = card(page).locator(".kids-inspector-title strong");
    const titleBox = (await title.boundingBox())!;
    expect(label.y + label.height).toBeLessThanOrEqual(titleBox.y + 1);
    await expect(title).toHaveText(/^Nova · x \d+ · y -?\d+$/);
    await expect(title).toHaveCSS("white-space", "nowrap");
    const close = (await card(page)
      .getByRole("button", { name: /^Cerrar/ })
      .boundingBox())!;
    expect(Math.round(close.width)).toBe(40);
    expect(Math.round(close.height)).toBe(40);

    // 6. Every action is at least 44 px tall.
    for (const button of await card(page).locator(".kids-inspector-body button").all())
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
    for (const input of await card(page).getByRole("spinbutton").all())
      expect((await input.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);

    // 7. The stage is above the card, and the page can scroll it fully above.
    const stageBottom = await page
      .locator(".kids-studio-stage")
      .evaluate((element) => element.getBoundingClientRect().bottom);
    if (viewport.name === "phone") expect(stageBottom).toBeLessThanOrEqual(box.y + 1);

    // 5. Close with the X, open again, close by tapping the round button.
    await card(page)
      .getByRole("button", { name: /^Cerrar/ })
      .click();
    await expect(card(page)).toHaveCount(0);
    await expect(fab(page)).toBeFocused();
    await fab(page).click();
    await expect(card(page)).toBeVisible();
    await fab(page).click();
    await expect(card(page)).toHaveCount(0);

    // Escape closes too and gives the focus back.
    await fab(page).click();
    await page.keyboard.press("Escape");
    await expect(card(page)).toHaveCount(0);
    await expect(fab(page)).toBeFocused();

    // 5. A tap on the bare stage puts both away.
    await fab(page).click();
    await expect(card(page)).toBeVisible();
    const stage = (await page.locator(".kids-studio-stage").boundingBox())!;
    await page.locator(".kids-studio-stage").scrollIntoViewIfNeeded();
    await page.locator(".kids-studio-stage").click({ position: { x: stage.width - 6, y: 6 } });
    await expect(card(page)).toHaveCount(0);
    await expect(fab(page)).toHaveCount(0);
  });
}

test("the card keeps working: place, layer and Ori act on the selected character (#1231)", async ({
  page,
}) => {
  await freeScene(page, { width: 1280, height: 800 });
  const actor = page.locator(".kids-studio-stage-actor").first();
  const before = await actor.getAttribute("style");
  await actor.click();
  await fab(page).click();
  await card(page).getByRole("button", { name: "Ubicar personaje →" }).click();
  expect(await actor.getAttribute("style")).not.toBe(before);
  // The header follows the character as it moves.
  await expect(card(page).locator(".kids-inspector-title strong")).toHaveText(/x 20/);
  await expect(card(page).getByRole("button", { name: "Traer adelante" })).toBeVisible();
  await expect(card(page).getByRole("button", { name: "Ori y este objeto" })).toBeVisible();
});

test("the card rides above the on-screen keyboard (#1231)", async ({ page }) => {
  await page.addInitScript(() => {
    const target = new EventTarget();
    const fake = Object.assign(target, { height: window.innerHeight, offsetTop: 0 });
    Object.defineProperty(window, "visualViewport", { value: fake, configurable: true });
    (window as unknown as { __setKeyboard: (px: number) => void }).__setKeyboard = (px) => {
      (fake as { height: number }).height = window.innerHeight - px;
      target.dispatchEvent(new Event("resize"));
    };
  });
  await freeScene(page, { width: 390, height: 844 });
  await page.locator(".kids-studio-stage-actor").first().click();
  await fab(page).click();
  const open = (await card(page).boundingBox())!;
  await page.evaluate(() =>
    (window as unknown as { __setKeyboard: (px: number) => void }).__setKeyboard(300),
  );
  await expect
    .poll(async () => Math.round(open.y - (await card(page).boundingBox())!.y))
    .toBeGreaterThanOrEqual(290);
  await page.evaluate(() =>
    (window as unknown as { __setKeyboard: (px: number) => void }).__setKeyboard(0),
  );
  await expect
    .poll(async () => Math.round((await card(page).boundingBox())!.y - open.y))
    .toBeLessThanOrEqual(1);
});
