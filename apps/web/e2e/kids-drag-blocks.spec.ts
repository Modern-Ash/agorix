import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.use({ hasTouch: true, serviceWorkers: "block" });

// Issue #593: blocks can be dragged in from the panel and reordered, and the keyboard and a tap
// still do the same things.
async function openScene(page: Page, width = 390, height = 844) {
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
  await page.reload();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
}

const blocks = (page: Page) => page.locator(".kids-program-drop > .kids-program-block");

async function dragBetween(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
}

const center = async (locator: ReturnType<Page["locator"]>) => {
  await locator.scrollIntoViewIfNeeded();
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test("dragging a block from the panel into the program adds it, a tap still does, a miss does not", async ({
  page,
}) => {
  await openScene(page, 1280, 3200);
  await expect(page.locator(".kids-program-drop")).toHaveAttribute(
    "data-hint",
    "Soltá acá para agregar",
  );
  const add = page.getByRole("button", { name: "+ Mover", exact: true });
  const girar = page.getByRole("button", { name: "+ Girar a la derecha" });
  // A drag released inside the program adds exactly one block.
  const list = page.locator(".kids-program-drop");
  await dragBetween(page, await center(add), await center(list));
  await expect(blocks(page)).toHaveCount(1);
  await expect(blocks(page).first()).toContainText("Mover");
  // A plain tap on a panel button still adds a block.
  await girar.click();
  await expect(blocks(page)).toHaveCount(2);
  // A drag released outside the program adds nothing and does not leave a stray tap behind.
  await dragBetween(page, await center(add), { x: 5, y: 5 });
  await expect(blocks(page)).toHaveCount(2);
  await expect(page.locator(".kids-drag-ghost")).toHaveCount(0);
});

test("blocks reorder with the keyboard buttons and by dragging the handle, and undo restores them", async ({
  page,
}) => {
  await openScene(page, 1280, 3200);
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
  await page.getByRole("button", { name: "+ Esperar", exact: true }).click();
  const order = async () =>
    (await blocks(page).locator("span").allTextContents())
      .filter(Boolean)
      .map((text) => /^[\p{L}]+/u.exec(text)?.[0]);
  expect(await order()).toEqual(["Mover", "Girar", "Esperar"]);
  await expect(page.getByRole("button", { name: "Subir bloque 1" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Bajar bloque 3" })).toBeDisabled();
  await page.getByRole("button", { name: "Bajar bloque 1" }).click();
  expect(await order()).toEqual(["Girar", "Mover", "Esperar"]);
  await page.getByRole("button", { name: "Subir bloque 3" }).click();
  expect(await order()).toEqual(["Girar", "Esperar", "Mover"]);
  // Drag the last block's handle above the first.
  const handle = await center(page.getByRole("button", { name: "Arrastrar bloque 3" }));
  const first = await center(blocks(page).first());
  await dragBetween(page, handle, { x: first.x, y: first.y - 12 });
  expect(await order()).toEqual(["Mover", "Girar", "Esperar"]);
  await page.getByRole("button", { name: "Deshacer" }).click();
  expect(await order()).toEqual(["Girar", "Esperar", "Mover"]);
  // The reordered program saves and runs in the new order.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Escena libre" })).toBeVisible();
  expect(await order()).toEqual(["Girar", "Esperar", "Mover"]);
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
});
