import { expect, test } from "@playwright/test";

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
    expect(s.x + s.width).toBeLessThanOrEqual(p.x + 1);
    expect(p.x + p.width).toBeLessThanOrEqual(g.x + g.width);
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

test("the Ori idea button shows its label next to the character", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openScene(page);
  const button = page.getByRole("button", { name: "Pedirle una idea a Ori" });
  await expect(button).toBeVisible();
  expect((await button.boundingBox())!.width).toBeGreaterThan(150);
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
