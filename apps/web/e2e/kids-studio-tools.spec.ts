import { expect, test } from "./fixtures.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

// Issue #1126: the tools an editor needs are reachable in Escena libre from a fresh session, with
// no flags: first steps, Play/Step debugging on the real runtime trace, undo/redo and export.
const PROGRESS = { onboarded: true, avatar: "🐸", stars: 0, done: {} };

async function openScene(page: import("@playwright/test").Page) {
  await page.goto("/kids");
  await page.evaluate((progress) => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem("agorix.kids.progress.v1", JSON.stringify(progress));
  }, PROGRESS);
  await page.reload();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
}

for (const [name, viewport] of [
  ["desktop", { width: 1280, height: 800 }],
  ["mobile", { width: 390, height: 844 }],
] as const) {
  test(`the category toolbar is visible above the stage on ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openScene(page);
    const toolbar = page.getByRole("navigation", { name: "Categorías de bloques" });
    const stage = page.getByRole("group", { name: "Escenario" });
    await expect(toolbar).toBeVisible();
    const toolbarBox = await toolbar.boundingBox();
    const stageBox = await stage.boundingBox();
    expect(toolbarBox).not.toBeNull();
    expect(stageBox).not.toBeNull();
    expect(toolbarBox!.y).toBeLessThan(stageBox!.y);
    expect(toolbarBox!.y).toBeLessThan(viewport.height);
    await toolbar.getByRole("button", { name: "Movimiento" }).click();
    await expect(page.getByRole("heading", { name: "Movimiento" })).toBeFocused();
  });
}

test("first steps follow the child, never block, end after Step and come back with Ayuda", async ({
  page,
}) => {
  await openScene(page);
  const coach = page.getByTestId("studio-tutorial");
  await expect(coach).toContainText("Elegí un bloque");

  // Play is never blocked: the coach just moves to what is next.
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await expect(coach).toContainText("Jugar");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(coach).toContainText("Paso");
  await page.getByRole("button", { name: "Paso", exact: true }).click();
  await expect(coach).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId("studio-tutorial")).toHaveCount(0);
  await page.getByRole("button", { name: "Ayuda", exact: true }).click();
  await expect(page.getByTestId("studio-tutorial")).toBeVisible();
  await page.getByRole("button", { name: "Listo, no mostrar más" }).click();
  await expect(page.getByTestId("studio-tutorial")).toHaveCount(0);
});

test("Play, Step and Back to start debug the run on the runtime trace; undo and redo restore blocks", async ({
  page,
}) => {
  await openScene(page);
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  const blocks = page.getByRole("button", { name: /^Quitar bloque \d+$/ });
  await expect(blocks).toHaveCount(2);

  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText(/2 bloques ejecutados/)).toBeVisible();
  const stage = page.getByRole("group", { name: "Escenario" });
  const before = await stage.innerHTML();
  await page.getByRole("button", { name: "Paso", exact: true }).click();
  expect(await stage.innerHTML()).not.toBe(before);
  await page.getByRole("button", { name: "Volver al inicio" }).click();
  await expect(page.getByText(/2 bloques ejecutados/)).toHaveCount(0);

  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(blocks).toHaveCount(1);
  await page.getByRole("button", { name: "Rehacer" }).click();
  await expect(blocks).toHaveCount(2);
});

test("a scene exports as a .agorix file from the editor", async ({ page }) => {
  await openScene(page);
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar escena" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.agorix$/);
});

// Issue #1110: palette, program and stage are on screen together on desktop and landscape tablet;
// on a phone nothing scrolls sideways and the controls stay touch sized.
for (const [name, viewport] of [
  ["desktop", { width: 1280, height: 800 }],
  ["landscape tablet", { width: 1024, height: 768 }],
] as const) {
  test(`palette, program and stage are visible together on ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openScene(page);
    const stage = page.getByRole("group", { name: "Escenario" });
    const program = page.getByRole("heading", { name: /^Programa de/ });
    const palette = page.getByRole("button", { name: /Mover/ }).first();
    const boxes = await Promise.all([stage, program, palette].map((l) => l.boundingBox()));
    for (const box of boxes) {
      expect(box).not.toBeNull();
      expect(box!.y).toBeLessThan(viewport.height);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    }
    const [s, g, p] = boxes.map((b) => b!);
    // Scratch order: blocks, then the program, then the stage on the right.
    expect(p.x + p.width).toBeLessThanOrEqual(g.x + 1);
    expect(g.x).toBeLessThan(s.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewport.width,
    );
  });
}

test("the phone layout has no horizontal scroll and touch-sized category buttons", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openScene(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const toolbar = page.getByRole("navigation", { name: "Categorías de bloques" });
  for (const button of await toolbar.getByRole("button").all()) {
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
});

test("Ori opens from the selected sprite with contextual help", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openScene(page);
  await expect(page.getByRole("button", { name: "Pedirle una idea a Ori" })).toBeHidden();
  await page.getByRole("button", { name: "Ori y este objeto" }).click();
  await expect(page.locator(".kids-ori-context")).toContainText("Estamos trabajando con");
  const button = page.getByRole("button", { name: "Pedirle una idea a Ori" });
  await expect(button).toBeVisible();
  expect((await button.boundingBox())!.width).toBeGreaterThan(150);
});

test("stage tools expose sprite, backdrop and editable position", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openScene(page);
  await page.getByRole("button", { name: "+ Objeto" }).click();
  await expect(page.getByRole("group", { name: "Elegir objeto" })).toBeVisible();
  await page.getByRole("button", { name: "Agregar objeto" }).click();
  const inspector = page.getByLabel("Objeto seleccionado");
  await expect(inspector).toBeVisible();
  await inspector.getByRole("spinbutton", { name: "x" }).fill("120");
  await inspector.getByRole("spinbutton", { name: "x" }).blur();
  await expect(inspector.getByRole("spinbutton", { name: "x" })).toHaveValue("120");
  await page.getByRole("button", { name: "+ Fondo" }).click();
  await expect(page.getByRole("group", { name: "Elegir fondo" })).toBeVisible();
  await page.getByRole("button", { name: "Usar fondo" }).click();
  await page.getByRole("button", { name: "🔊 Sonidos" }).click();
  await expect(page.locator(".kids-studio-media-content")).toBeVisible();
});

test("the phone palette is a bottom sheet that adds blocks, closes and reopens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openScene(page);
  const toggle = page.getByRole("button", { name: "Cerrar bloques" });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const add = page.getByRole("button", { name: /Mover/ }).first();
  const sheet = await add.boundingBox();
  expect(sheet!.y + sheet!.height).toBeLessThanOrEqual(844);
  await add.click();
  await expect(page.locator(".kids-program-block").first()).toBeVisible();
  await toggle.click();
  await expect(page.getByRole("button", { name: /^\+? ?Mover/ }).first()).toBeHidden();
  await page.getByRole("button", { name: "Agregar bloques" }).click();
  await expect(page.getByRole("button", { name: /Mover/ }).first()).toBeVisible();
  expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test("the sound chooser filters by category and search, and adds the chosen sound", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openScene(page);
  const picker = page.getByRole("group", { name: "Sonidos", exact: true });
  await expect(picker.getByTestId("sound-picker-selected")).toContainText("Pop");
  const all = await picker.getByRole("button", { name: /^Elegir y escuchar/ }).count();
  expect(all).toBeGreaterThan(60);
  await picker.getByRole("button", { name: "Animales", exact: true }).click();
  const animals = await picker.getByRole("button", { name: /^Elegir y escuchar/ }).count();
  expect(animals).toBeGreaterThan(0);
  expect(animals).toBeLessThan(all);
  await picker.getByRole("button", { name: "Todos", exact: true }).click();
  await picker.getByRole("searchbox", { name: "Buscar sonido" }).fill("campana");
  await picker.getByRole("button", { name: "Elegir y escuchar Campana" }).click();
  await expect(picker.getByTestId("sound-picker-selected")).toContainText("Campana");
  await page.getByRole("button", { name: "+ Sonar", exact: true }).click();
  await expect(page.locator(".kids-program-block").last()).toContainText("Sonar: Campana");
  await picker.getByRole("searchbox", { name: "Buscar sonido" }).fill("zzzz");
  await expect(picker.getByText("No hay sonidos así.")).toBeVisible();
});

test("the verdict card checks the guess against the run and marks match or difference", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openScene(page);
  await page.getByRole("button", { name: "+ Mover", exact: true }).first().click();
  const chip = page.getByLabel("a la derecha");
  await chip.check();
  expect((await chip.locator("xpath=..").boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  const verdict = page.getByTestId("coach-prediction");
  await expect(verdict).toHaveAttribute("data-verdict", "match");
  await expect(verdict).toContainText("pasó eso");
  await expect(page.getByRole("region", { name: "Qué pasó" })).toContainText("empezó en");
  await page.getByLabel("a la izquierda").check();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByTestId("coach-prediction")).toHaveAttribute("data-verdict", "differs");
  await expect(page.getByTestId("coach-prediction")).toContainText("pero fue");
});

test("a block can be duplicated, undone and redone", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openScene(page);
  await page.getByRole("button", { name: "+ Mover", exact: true }).first().click();
  await page.getByRole("button", { name: "+ Decir", exact: true }).first().click();
  await expect(page.locator(".kids-program-block")).toHaveCount(2);
  await page.getByRole("button", { name: "Duplicar bloque 1" }).click();
  const blocks = page.locator(".kids-program-block");
  await expect(blocks).toHaveCount(3);
  await expect(blocks.nth(0)).toContainText("Mover");
  await expect(blocks.nth(1)).toContainText("Mover");
  await expect(blocks.nth(2)).toContainText("Decir");
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(blocks).toHaveCount(2);
  await page.getByRole("button", { name: "Rehacer" }).click();
  await expect(blocks).toHaveCount(3);
});

test("the stage can fill the screen, still plays, and Escape brings it back", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openScene(page);
  const stage = page.getByRole("group", { name: "Escenario" });
  const normal = (await stage.boundingBox())!;
  const toggle = page.getByRole("button", { name: "Agrandar escenario" });
  await toggle.click();
  await expect(page.getByRole("button", { name: "Volver al tamaño normal" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const large = (await stage.boundingBox())!;
  expect(large.width).toBeGreaterThan(normal.width);
  expect(large.y + large.height).toBeLessThanOrEqual(800);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Agrandar escenario" })).toBeVisible();
  expect((await stage.boundingBox())!.width).toBeCloseTo(normal.width, -1);
});

test("a block's menu duplicates, moves and removes it, with mouse and keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openScene(page);
  await page.getByRole("button", { name: "+ Mover", exact: true }).first().click();
  await page.getByRole("button", { name: "+ Decir", exact: true }).first().click();
  const blocks = page.locator(".kids-program-block");
  await expect(blocks).toHaveCount(2);
  await blocks.nth(0).click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Acciones del bloque" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem").first()).toBeFocused();
  await menu.getByRole("menuitem", { name: "Duplicar bloque" }).click();
  await expect(blocks).toHaveCount(3);
  await expect(menu).toBeHidden();
  // Keyboard: the menu key opens it on the focused block; arrows move, Escape closes.
  await blocks.nth(2).focus();
  await page.keyboard.press("Shift+F10");
  await expect(menu).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(blocks).toHaveCount(3);
  await blocks.nth(0).click({ button: "right" });
  await menu.getByRole("menuitem", { name: "Quitar bloque" }).click();
  await expect(blocks).toHaveCount(2);
  await blocks.nth(0).click({ button: "right" });
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});

test("keyboard shortcuts undo, redo, duplicate and delete the focused block and list themselves", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openScene(page);
  await page.getByRole("button", { name: "+ Mover", exact: true }).first().click();
  const blocks = page.locator(".kids-program-block");
  await blocks.nth(0).focus();
  await page.keyboard.press("Control+d");
  await expect(blocks).toHaveCount(2);
  await blocks.nth(1).focus();
  await page.keyboard.press("Delete");
  await expect(blocks).toHaveCount(1);
  await page.keyboard.press("Control+z");
  await expect(blocks).toHaveCount(2);
  await page.keyboard.press("Control+Shift+z");
  await expect(blocks).toHaveCount(1);
  await page.keyboard.press("?");
  const dialog = page.getByRole("dialog", { name: "Atajos del editor" });
  await expect(dialog).toContainText("Ctrl/Cmd+D");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  // Typing in a field never triggers a shortcut.
  await page.getByRole("searchbox", { name: "Buscar sonido" }).fill("?");
  await expect(dialog).toBeHidden();
});

test("a category moves only the block list, and the blocks, code and Ori help fold away", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openScene(page);
  const rail = page.getByRole("navigation", { name: "Categorías de bloques" });
  const before = await page.evaluate(() => window.scrollY);
  await rail.getByRole("button", { name: "Música" }).click();
  await expect(page.locator("#kids-studio-cat-music")).toBeFocused();
  await expect(rail.getByRole("button", { name: "Música" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  // The page itself does not jump; the list inside the blocks panel is what moved.
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  await expect
    .poll(() => page.locator(".kids-studio-palette").evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);

  const hideBlocks = page.getByRole("button", { name: "Ocultar bloques" });
  await hideBlocks.click();
  await expect(page.getByRole("button", { name: "+ Mover", exact: true }).first()).toBeHidden();
  await page.getByRole("button", { name: "Mostrar bloques" }).click();
  await expect(page.getByRole("button", { name: "+ Mover", exact: true }).first()).toBeVisible();
  // Choosing a category reopens a folded panel.
  await page.getByRole("button", { name: "Ocultar bloques" }).click();
  await rail.getByRole("button", { name: "Movimiento" }).click();
  await expect(page.getByRole("button", { name: "Ocultar bloques" })).toBeVisible();

  await page.getByRole("button", { name: "Ocultar código" }).click();
  await expect(page.locator(".kids-code-strip")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Código" })).toBeVisible();
  await page.getByRole("button", { name: "Mostrar código" }).click();
  await expect(page.locator(".kids-code-strip")).toBeVisible();

  await page.getByRole("button", { name: "Mostrar ayuda de Ori" }).click();
  await expect(page.getByRole("button", { name: "Pedirle una idea a Ori" })).toBeVisible();
  await page.getByRole("button", { name: "Ocultar ayuda de Ori" }).click();
  await expect(page.getByRole("button", { name: "Pedirle una idea a Ori" })).toBeHidden();
  await page.getByRole("button", { name: "Mostrar ayuda de Ori" }).click();
  await expect(page.getByRole("button", { name: "Pedirle una idea a Ori" })).toBeVisible();
});
