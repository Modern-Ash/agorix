import { expect, test } from "@playwright/test";

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

  await shelf.locator('[data-starter="move"]').click();
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

test("a child combines two conditions with y, o and no, and the program keeps them", async ({
  page,
}) => {
  await SEED(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();

  const group = page.getByRole("group", { name: "Combinar condiciones" });
  await group.getByRole("combobox", { name: "Primera condición" }).selectOption("key");
  await group.getByRole("combobox", { name: "Segunda condición" }).selectOption("edge");
  await group.getByRole("combobox", { name: "Unir con" }).selectOption("and");
  await group.getByTestId("compound-if").click();

  await group.getByRole("combobox", { name: "Unir con" }).selectOption("or");
  await group.getByRole("checkbox", { name: "al revés (no)" }).check();
  await group.getByTestId("compound-if").click();

  const blocks = page.getByRole("list", { name: /Arrastrá un bloque/ });
  await expect(blocks).toContainText("tecla Space pulsada y tocando borde");
  await expect(blocks).toContainText("no (tecla Space pulsada o tocando borde)");

  await page.reload();
  await expect(page.getByRole("list", { name: /Arrastrá un bloque/ })).toContainText(
    "no (tecla Space pulsada o tocando borde)",
  );
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Jugar", exact: true })).toBeEnabled();
});
