import { expect, test } from "@playwright/test";
import { STUDIO_BLOCK_CATEGORY } from "../src/kids/kidsPaletteCatalog.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

// Issue #1121: both free creation paths open from a fresh onboarded profile with no mission done,
// without touching the map or the progression.
const PROGRESS = { onboarded: true, avatar: "🐸", stars: 0, done: {} };

test("free scene and free project open without finishing a mission and leave progress intact", async ({
  page,
}) => {
  await page.goto("/kids");
  await page.evaluate((progress) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem("agorix.kids.progress.v1", JSON.stringify(progress));
  }, PROGRESS);
  await page.reload();

  // Escena libre = the Studio: whole categorized palette, never the mission subset.
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  await expect(page).toHaveURL(/#\/escena\//);
  await expect
    .poll(() => page.locator(".kids-studio-palette [data-kids-palette-tool]").count())
    .toBeGreaterThan(15);

  // ¡Crear! = a free project in the single-character editor.
  await page.getByRole("button", { name: "Volver a Crear" }).click();
  await page.getByRole("button", { name: "¡Crear!" }).click();
  await expect(page).toHaveURL(/#\/libre\//);
  await expect(page.getByRole("button", { name: "Jugar", exact: true })).toBeVisible();

  // The map and its first mission are still there and still locked to the learner's progress.
  await page.getByRole("button", { name: "Mapa" }).click();
  await expect(page.getByRole("heading", { name: "Mapa" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Misión 1" })).toBeVisible();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("agorix.kids.progress.v1") ?? "{}")),
  ).toMatchObject({ stars: 0, done: {} });
});

for (const [name, viewport] of [
  ["desktop", { width: 1280, height: 800 }],
  ["tablet", { width: 820, height: 1180 }],
  ["mobile", { width: 390, height: 844 }],
] as const) {
  test(`the create deep link reaches both free paths on ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/kids");
    await page.evaluate((progress) => {
      localStorage.clear();
      localStorage.setItem("agorix.locale", "es");
      localStorage.setItem("agorix.kids.progress.v1", JSON.stringify(progress));
    }, PROGRESS);
    await page.goto("/kids#/crear");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Escena libre", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear escena" })).toBeVisible();
    await expect(page.getByRole("button", { name: "¡Crear!" })).toBeVisible();
  });
}

const SEED = async (page: import("@playwright/test").Page) => {
  await page.goto("/kids");
  await page.evaluate((progress) => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem("agorix.kids.progress.v1", JSON.stringify(progress));
  }, PROGRESS);
  await page.reload();
};

test("the Escena libre starter shelf adds blocks and leaves the whole palette in place", async ({
  page,
}) => {
  await SEED(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await expect(page.getByTestId("free-project-note")).toContainText("Escena libre");
  await page.getByRole("button", { name: "Crear escena" }).click();

  const shelf = page.getByRole("region", { name: "Para empezar" });
  await expect(shelf.locator("[data-starter]")).toHaveCount(3);
  const paletteBefore = await page.locator("[data-kids-palette-tool]").count();
  expect(paletteBefore).toBeGreaterThan(15);

  await expect(shelf.locator('[data-starter="repeat"]')).toHaveCount(0);
  await shelf.locator('[data-starter="move"]').click();
  // Using a concept earns the next starter (#1133).
  await expect(shelf.locator('[data-starter="repeat"]')).toHaveCount(1);
  await shelf.locator('[data-starter="turn"]').click();
  await expect(page.getByRole("button", { name: /^Quitar bloque \d+$/ })).toHaveCount(2);
  // The shelf adds to the program and the palette keeps every block.
  expect(await page.locator("[data-kids-palette-tool]").count()).toBe(paletteBefore);
});

test("a scene goal is checked against the run, survives a reload and can be removed", async ({
  page,
}) => {
  await SEED(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();

  await page
    .getByRole("combobox", { name: "Elegir una meta" })
    .selectOption({ label: "Nova llega al borde" });
  await expect(page.getByTestId("scene-goal")).toHaveText("Nova llega al borde");

  // Nothing runs yet, so the goal is not reached.
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByTestId("scene-goal-result")).toContainText("Todavía no");

  const shelf = page.getByRole("region", { name: "Para empezar" });
  for (let step = 0; step < 8; step++) await shelf.locator('[data-starter="move"]').click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByTestId("scene-goal-result")).toContainText("¡Lograste la meta!");

  await page.reload();
  await expect(page.getByTestId("scene-goal")).toHaveText("Nova llega al borde");
  await page.getByRole("button", { name: "Quitar meta" }).click();
  await expect(page.getByRole("combobox", { name: "Elegir una meta" })).toBeVisible();
});

test("Ori proposes a scene goal; the child can ask for another, accept it or decline", async ({
  page,
}) => {
  await SEED(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  await page.getByRole("button", { name: "+ Agregar personaje" }).click();

  const ori = page.getByRole("complementary", { name: "Metas de Ori" });
  await ori.getByRole("button", { name: "Inventá una meta" }).click();
  const first = await ori.getByTestId("ori-scene-goal").locator("p").first().textContent();
  expect(first).toMatch(/^¿Podés hacer que .+\?$/);

  // Declining leaves the scene without a goal and changes nothing.
  await ori.getByRole("button", { name: "Ahora no" }).click();
  await expect(page.getByTestId("scene-goal")).toHaveCount(0);

  await ori.getByRole("button", { name: "Inventá una meta" }).click();
  await ori.getByRole("button", { name: "Otra idea" }).click();
  await expect(ori.getByTestId("ori-scene-goal")).toBeVisible();

  // Accepting only sets the goal; the program is untouched until the child runs it.
  await ori.getByRole("button", { name: "Elegir esta meta" }).click();
  await expect(page.getByTestId("scene-goal")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Quitar bloque \d+$/ })).toHaveCount(0);
});

// Issue #1135: a remote Ori ranks the goals the child could already pick; it answers with one
// index and the wording stays local. An invalid or failed answer keeps the local ranking.
test("a remote Ori ranks the scene goal by index and the wording stays local", async ({ page }) => {
  let sent: unknown = null;
  await page.route("**/api/tutor/scene-goals", async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ json: { choice: 2 } });
  });
  await SEED(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  await page.getByRole("button", { name: "+ Agregar personaje" }).click();
  await expect.poll(() => sent).not.toBeNull();
  expect(Object.keys(sent as object).sort()).toEqual(["choices", "locale"]);

  const ori = page.getByRole("complementary", { name: "Metas de Ori" });
  await ori.getByRole("button", { name: "Inventá una meta" }).click();
  // Choice 2 is Nova reaching the edge, not the local favourite (Nova touches Mika).
  await expect(ori.getByTestId("ori-scene-goal")).toContainText("llegue al borde");
});

// Issue #1135: with a goal set, Ori can suggest a block the character has not used yet. The block
// is a visible proposal; nothing enters the program until the child accepts it.
test("Ori suggests a block for the goal; the child can change, decline or accept it", async ({
  page,
}) => {
  await SEED(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  await page.getByRole("button", { name: "+ Agregar personaje" }).click();
  await page.getByRole("combobox", { name: "Elegir una meta" }).selectOption({ index: 1 });
  await expect(page.getByTestId("scene-goal")).toBeVisible();
  // The goal is Nova's, so look at Nova's script.
  await page.getByRole("button", { name: /^Elegí un personaje: Nova/ }).click();

  const ori = page.getByRole("complementary", { name: "Bloques de Ori" });
  await ori.getByRole("button", { name: "¿Qué bloque me ayuda?" }).click();
  await expect(ori.getByTestId("ori-goal-block-diff")).toHaveText("+ Mover");
  await expect(page.getByRole("button", { name: /^Quitar bloque \d+$/ })).toHaveCount(0);

  await ori.getByRole("button", { name: "Otro bloque" }).click();
  await expect(ori.getByTestId("ori-goal-block-diff")).not.toHaveText("+ Mover");

  await ori.getByRole("button", { name: "Ahora no" }).click();
  await expect(page.getByRole("button", { name: /^Quitar bloque \d+$/ })).toHaveCount(0);

  await ori.getByRole("button", { name: "¿Qué bloque me ayuda?" }).click();
  await ori.getByRole("button", { name: "Usar este bloque" }).click();
  await expect(page.getByRole("button", { name: /^Quitar bloque \d+$/ })).toHaveCount(1);
  // Mover is used now, so the next idea is a different block.
  await ori.getByRole("button", { name: "¿Qué bloque me ayuda?" }).click();
  await expect(ori.getByTestId("ori-goal-block-diff")).not.toHaveText("+ Mover");
});

// Issue #1133: the palette offers every block the catalog lists, under its own category, so an
// engine block added to `STUDIO_BLOCK_CATEGORY` that the palette forgets fails here.
test("the Escena libre palette offers every cataloged block", async ({ page }) => {
  await SEED(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  // Variable and list blocks appear once one exists.
  await page.getByRole("textbox", { name: "Nombre" }).fill("Cuenta");
  await page.getByRole("button", { name: "+ Crear variable" }).click();
  await page.getByRole("textbox", { name: "Nombre" }).fill("Cosas");
  await page.getByRole("button", { name: "+ Crear lista" }).click();
  await expect
    .poll(() => page.locator(".kids-studio-palette [data-kids-block]").count())
    .toBeGreaterThan(15);

  const offered = await page
    .locator(".kids-studio-palette [data-kids-block]")
    .evaluateAll((nodes) => [
      ...new Set(nodes.map((node) => node.getAttribute("data-kids-block"))),
    ]);
  // Offered only once the project has what they point at: another character, or a made block.
  const needsProjectContent = ["pointTowards", "callProcedure"];
  const missing = Object.keys(STUDIO_BLOCK_CATEGORY).filter(
    (kind) => !offered.includes(kind) && !needsProjectContent.includes(kind),
  );
  expect(missing).toEqual([]);
});
