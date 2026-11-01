import { expect, test, type Page } from "./fixtures.js";

import { BLOCKS_UNLOCKED } from "./helpers.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

async function open(page: Page, flags: string[]) {
  await page.goto("/kids");
  await page.evaluate((enabled) => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem("agorix.kids.flags.v1", JSON.stringify(enabled));
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  }, flags);
  await page.evaluate(
    (state) => localStorage.setItem("agorix.kids.mastery.v1", state),
    BLOCKS_UNLOCKED,
  );
  await page.reload();
  await page.getByRole("button", { name: "Misión 1" }).click();
}

test("150% zoom inserts a dragged block into slot two without changing the world", async ({
  page,
}) => {
  // The palette now sits above the program, so the zoomed program needs a taller window.
  await page.setViewportSize({ width: 1280, height: 1400 });
  await open(page, ["zoom"]);
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  await page.getByRole("button", { name: "+ sonar", exact: true }).click();
  const world = await page.locator(".kids-world-grid").boundingBox();
  await page.getByRole("button", { name: "Ampliar bloques" }).click();
  await page.getByRole("button", { name: "Ampliar bloques" }).click();
  await expect(page.getByRole("status", { name: "Tamaño de bloques" })).toHaveText("150%");
  expect(await page.locator(".kids-world-grid").boundingBox()).toEqual(world);
  const source = page.getByRole("button", { name: "+ girar →", exact: true });
  const target = page.locator(".kids-program-stack > ul > li").first();
  await source.dragTo(target, { targetPosition: { x: 30, y: 70 } });
  await expect(page.locator(".kids-program-stack > ul > li")).toHaveCount(3);
  await expect(page.locator(".kids-program-stack > ul > li").nth(1)).toHaveClass(
    /kids-block-turnR/,
  );
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "No sé" }).click();
  const outcome = await page.locator(".kids-world-grid").getAttribute("aria-label");
  await page.getByRole("button", { name: "Restablecer tamaño" }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "No sé" }).click();
  expect(await page.locator(".kids-world-grid").getAttribute("aria-label")).toBe(outcome);
});

test("context menu explains, duplicates and deletes with undo; keyboard opens it", async ({
  page,
}) => {
  await open(page, ["contextMenu"]);
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  const block = page.locator(".kids-program-stack > ul > li").first();
  await block.click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Opciones del bloque" });
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: "Explicar" }).click();
  await expect(page.getByRole("status").filter({ hasText: "avanza 1 casillas" })).toBeVisible();
  await block.focus();
  await page.keyboard.press("Shift+F10");
  await menu.getByRole("menuitem", { name: "Duplicar" }).click();
  await expect(page.locator(".kids-program-stack > ul > li")).toHaveCount(2);
  await page.locator(".kids-program-stack > ul > li").last().click({ button: "right" });
  await menu.getByRole("menuitem", { name: "Borrar" }).click();
  await expect(page.locator(".kids-program-stack > ul > li")).toHaveCount(1);
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.locator(".kids-program-stack > ul > li")).toHaveCount(2);
});

test("shortcuts work on focused blocks and stay quiet in an input or prediction dialog", async ({
  page,
}) => {
  await open(page, ["shortcuts"]);
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  const block = page.locator(".kids-program-stack > ul > li").first();
  await block.focus();
  await page.keyboard.press("Control+d");
  await expect(page.locator(".kids-program-stack > ul > li")).toHaveCount(2);
  await page.keyboard.press("Control+z");
  await expect(page.locator(".kids-program-stack > ul > li")).toHaveCount(1);
  await page.keyboard.press("Control+y");
  await expect(page.locator(".kids-program-stack > ul > li")).toHaveCount(2);
  await block.focus();
  await page.keyboard.press("Delete");
  await expect(page.locator(".kids-program-stack > ul > li")).toHaveCount(1);
  await page.getByRole("button", { name: "Atajos del editor" }).focus();
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "Atajos del editor" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Atajos del editor" }).click();
  await expect(page.getByRole("dialog", { name: "Atajos del editor" })).toContainText("Ctrl/Cmd+D");
  await page.keyboard.press("Escape");
  await page.locator(".kids-world-grid").focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Control+z");
  await expect(page.locator(".kids-program-stack > ul > li")).toHaveCount(1);
});

test("long press opens the accessible menu and moving the finger cancels it", async ({ page }) => {
  await open(page, ["contextMenu"]);
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  const block = page.locator(".kids-program-stack > ul > li").first();
  await block.dispatchEvent("pointerdown", { pointerType: "touch", clientX: 30, clientY: 30 });
  await block.dispatchEvent("pointermove", { pointerType: "touch", clientX: 50, clientY: 30 });
  await page.waitForTimeout(550);
  await expect(page.getByRole("menu")).toHaveCount(0);
  await block.dispatchEvent("pointerdown", { pointerType: "touch", clientX: 30, clientY: 30 });
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Duplicar" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "Borrar" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
});

test("typing in Ori chat does not fire edit shortcuts", async ({ page }) => {
  await open(page, ["shortcuts"]);
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  await page.getByRole("button", { name: "Preguntale a Ori" }).click();
  const input = page.getByRole("textbox", { name: "Tu pregunta" });
  await input.fill("quiero probar");
  await input.press("Control+a");
  await input.press("Control+z");
  await expect(page.locator(".kids-program-stack > ul > li")).toHaveCount(1);
});
