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

const TOUCH_HOLD_MS = 250;

/**
 * Playwright's touchscreen API cannot hold and drag in one gesture, so issue #817 exercises the
 * real pointer handlers with synthetic touch PointerEvents instead.
 */
async function touchPointer(
  page: Page,
  type: "pointerdown" | "pointermove" | "pointerup",
  at: { x: number; y: number },
) {
  await page.evaluate(
    ({ type, x, y }) => {
      const event = new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerId: 7,
        pointerType: "touch",
        isPrimary: true,
        clientX: x,
        clientY: y,
      });
      if (type === "pointerdown") {
        const button = document.elementFromPoint(x, y)?.closest("button");
        if (!button) throw new Error("No palette button at the start point");
        button.dispatchEvent(event);
      } else {
        window.dispatchEvent(event);
      }
    },
    { type, x: at.x, y: at.y },
  );
}

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

test("a touch drag waits for the 250ms hold, then adds one block and cleans up the ghost", async ({
  page,
}) => {
  await openScene(page, 1280, 3200);
  const add = page.getByRole("button", { name: "+ Mover", exact: true });
  const from = await center(add);
  const to = await center(page.locator(".kids-program-drop"));
  await touchPointer(page, "pointerdown", from);
  await page.waitForTimeout(TOUCH_HOLD_MS + 150);
  await touchPointer(page, "pointermove", to);
  await expect(page.locator(".kids-drag-ghost")).toHaveCount(1);
  await touchPointer(page, "pointerup", to);
  await expect(blocks(page)).toHaveCount(1);
  await expect(blocks(page).first()).toContainText("Mover");
  await expect(page.locator(".kids-drag-ghost")).toHaveCount(0);
});

test("a touch that moves before the hold is a scroll and adds no block", async ({ page }) => {
  await openScene(page, 1280, 3200);
  const add = page.getByRole("button", { name: "+ Mover", exact: true });
  const from = await center(add);
  const to = await center(page.locator(".kids-program-drop"));
  await touchPointer(page, "pointerdown", from);
  await touchPointer(page, "pointermove", to);
  await touchPointer(page, "pointerup", to);
  await expect(blocks(page)).toHaveCount(0);
  await expect(page.locator(".kids-drag-ghost")).toHaveCount(0);
  // The cancelled gesture does not swallow the next tap.
  await add.click();
  await expect(blocks(page)).toHaveCount(1);
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

const nested = (page: Page) => page.locator(".kids-program-drop .kids-nested-block");

async function repeatOfTwo(page: Page) {
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
  await page.getByRole("button", { name: "Repetir estos bloques", exact: true }).click();
  await page.getByRole("button", { name: "+ Esperar", exact: true }).click();
  await expect(blocks(page)).toHaveCount(2);
  await expect(nested(page)).toHaveCount(2);
}

test("a block can be dragged into a repeat and taken out again, and the keyboard does the same", async ({
  page,
}) => {
  await openScene(page, 1280, 3200);
  await repeatOfTwo(page);
  // Drag the loose "Esperar" into the repeat's body: it becomes a third block inside it.
  const handle = await center(page.getByRole("button", { name: "Arrastrar bloque 2" }));
  const body = page.locator(".kids-program-drop .kids-studio-nested-blocks").first();
  const rows = nested(page);
  const lastRow = await center(rows.last());
  await dragBetween(page, handle, { x: lastRow.x, y: lastRow.y + 20 });
  await expect(nested(page)).toHaveCount(3);
  await expect(blocks(page)).toHaveCount(1);
  void body;
  // Take it out with the button: it goes right after the repeat.
  await page.getByRole("button", { name: /^Sacar del bloque: Esperar/ }).click();
  await expect(nested(page)).toHaveCount(2);
  await expect(blocks(page)).toHaveCount(2);
  // The same move from the keyboard: the "Mover bloque a…" choice.
  const choose = page.getByRole("combobox", { name: /^Mover bloque a… 2$/ });
  await choose.selectOption({ index: 1 });
  await expect(nested(page)).toHaveCount(3);
  await expect(blocks(page)).toHaveCount(1);
});

test("a block can be given to another character by dragging it onto them or by choosing them", async ({
  page,
}) => {
  await openScene(page, 1280, 3200);
  await page.getByRole("button", { name: "+ Agregar personaje" }).click();
  await page.getByRole("group", { name: "Personajes" }).getByRole("button").first().click();
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Esperar", exact: true }).click();
  await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
  await expect(blocks(page)).toHaveCount(3);
  const second = page.getByRole("group", { name: "Personajes" }).getByRole("button").nth(1);
  // Drag the first block onto the second character.
  await dragBetween(
    page,
    await center(page.getByRole("button", { name: "Arrastrar bloque 1" })),
    await center(second),
  );
  await expect(blocks(page)).toHaveCount(2);
  // Choose a character for another block, without dragging.
  await page.getByLabel("Mover bloque a… 1").selectOption({ index: 1 });
  await expect(blocks(page)).toHaveCount(1);
  await page.getByRole("group", { name: "Personajes" }).getByRole("button").nth(1).click();
  await expect(blocks(page)).toHaveCount(2);
  // Undo brings the last gift back to the first character.
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(blocks(page)).toHaveCount(1);
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
});

test("a block dragged from the panel lands inside a repeat when dropped there", async ({
  page,
}) => {
  await openScene(page, 1280, 3200);
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
  await page.getByRole("button", { name: "Repetir estos bloques", exact: true }).click();
  await expect(nested(page)).toHaveCount(2);
  const add = page.getByRole("button", { name: "+ Esperar", exact: true });
  const target = await center(nested(page).last());
  await dragBetween(page, await center(add), { x: target.x, y: target.y + 20 });
  await expect(nested(page)).toHaveCount(3);
  await expect(blocks(page)).toHaveCount(1);
});
