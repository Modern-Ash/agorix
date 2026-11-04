import { expect, test, type Page } from "./fixtures.js";
import { clickCreateScene } from "./helpers.js";

// Issue #1231: the Properties ("Propiedades") panel is a floating card, opened on demand with a double
// tap on a character of the stage (Enter again on the selected one, with the keyboard).
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

const card = (page: Page) => page.getByLabel("Propiedades", { exact: true });
const firstActor = (page: Page) => page.locator(".kids-studio-stage-actor").first();

for (const viewport of VIEWPORTS) {
  test(`a double tap on a character opens its panel at ${viewport.name}`, async ({ page }) => {
    await freeScene(page, viewport);

    // Nothing is shown by itself, and there is no floating button at all.
    await expect(card(page)).toHaveCount(0);
    await expect(page.locator(".kids-inspector-fab")).toHaveCount(0);

    // One tap only selects.
    await firstActor(page).click();
    await expect(card(page)).toHaveCount(0);

    // Two quick taps open the card: 8 px margins, 18 px corners, at most 48vh, scrolls inside.
    await firstActor(page).dblclick();
    await expect(card(page)).toBeVisible();
    const box = (await card(page).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(7);
    expect(box.height).toBeLessThanOrEqual(viewport.height * 0.48 + 1);
    expect(viewport.height - (box.y + box.height)).toBeGreaterThanOrEqual(7);
    await expect(card(page)).toHaveCSS("border-top-left-radius", "18px");
    await expect(card(page).locator(".kids-inspector-body")).toHaveCSS("overflow-y", "auto");

    // Header: label above "Nombre · x · y" on one line; the close button is 40 px.
    const label = (await card(page).locator(".kids-inspector-title small").boundingBox())!;
    const title = card(page).locator(".kids-inspector-title strong");
    expect(label.y + label.height).toBeLessThanOrEqual((await title.boundingBox())!.y + 1);
    await expect(title).toHaveText(/^Nova · x \d+ · y -?\d+$/);
    await expect(title).toHaveCSS("white-space", "nowrap");
    const close = (await card(page)
      .getByRole("button", { name: /^Cerrar/ })
      .boundingBox())!;
    expect(Math.round(close.width)).toBe(40);
    expect(Math.round(close.height)).toBe(40);

    // Every control is at least 44 px tall.
    for (const button of await card(page).locator(".kids-inspector-body button").all())
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
    for (const input of await card(page).getByRole("spinbutton").all())
      expect((await input.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);

    // On a phone the stage stays above the card.
    const stageBottom = await page
      .locator(".kids-studio-stage")
      .evaluate((element) => element.getBoundingClientRect().bottom);
    if (viewport.name === "phone") expect(stageBottom).toBeLessThanOrEqual(box.y + 1);

    // Close with the X, and with Escape.
    await card(page)
      .getByRole("button", { name: /^Cerrar/ })
      .click();
    await expect(card(page)).toHaveCount(0);
    await firstActor(page).dblclick();
    await expect(card(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(card(page)).toHaveCount(0);

    // A tap on the bare stage puts it away too.
    await firstActor(page).dblclick();
    await expect(card(page)).toBeVisible();
    const stage = (await page.locator(".kids-studio-stage").boundingBox())!;
    await page.locator(".kids-studio-stage").scrollIntoViewIfNeeded();
    await page.locator(".kids-studio-stage").click({ position: { x: stage.width - 6, y: 6 } });
    await expect(card(page)).toHaveCount(0);
  });
}

test("a double tap on the empty stage shows the backdrop's properties (#1231)", async ({
  page,
}) => {
  await freeScene(page, { width: 1280, height: 800 });
  const stage = page.locator(".kids-studio-stage");
  const box = (await stage.boundingBox())!;
  const corner = { x: box.width - 8, y: 8 };
  await stage.click({ position: corner });
  await expect(card(page)).toHaveCount(0);
  await page.waitForTimeout(500); // a separate gesture, not the start of a double tap
  await stage.dblclick({ position: corner });
  await expect(card(page)).toBeVisible();
  await expect(card(page).locator(".kids-inspector-title strong")).toHaveText(/^Fondo · /);
  await expect(card(page).getByRole("button", { name: "Elegir fondo" })).toBeVisible();
  // It follows what is tapped: a double tap on a character switches to that character.
  await firstActor(page).dblclick();
  await expect(card(page).locator(".kids-inspector-title strong")).toHaveText(/^Nova · x/);
});

test("slow taps do not open the panel; the keyboard opens it on the selected character (#1231)", async ({
  page,
}) => {
  await freeScene(page, { width: 1280, height: 800 });
  await firstActor(page).click();
  await page.waitForTimeout(600);
  await firstActor(page).click();
  await expect(card(page)).toHaveCount(0);
  // Keyboard: Enter on a character that is already selected opens its panel.
  await firstActor(page).focus();
  await page.keyboard.press("Enter");
  await expect(card(page)).toBeVisible();
});

test("the card keeps working: place, layer and Ori act on the selected character (#1231)", async ({
  page,
}) => {
  await freeScene(page, { width: 1280, height: 800 });
  const actor = firstActor(page);
  const before = await actor.getAttribute("style");
  await actor.dblclick();
  await card(page).getByRole("button", { name: "Ubicar personaje →" }).click();
  expect(await actor.getAttribute("style")).not.toBe(before);
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
  await firstActor(page).dblclick();
  await expect(card(page)).toBeVisible();
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
