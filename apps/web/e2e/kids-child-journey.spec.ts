import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "./fixtures.js";
import { reloadTo } from "./helpers.js";

// Issue #1220: one test that walks a whole child's creation, end to end. The pieces are covered
// one by one elsewhere; this keeps the chain working: a fresh browser, a scene with two
// characters, a costume, a sound and an event, Play, debug with Step, save, reopen, export and
// import. It needs no AI and no network beyond the app itself.
test.use({ hasTouch: true, serviceWorkers: "block" });

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "phone", width: 390, height: 844 },
] as const;

const blocksOf = (page: Page) => page.locator(".kids-program-block");
const stageActors = (page: Page) => page.locator(".kids-studio-stage-actor");
const firstCostume = (page: Page) => stageActors(page).first().locator(".kids-art-image");
const costumeImage = (page: Page) =>
  firstCostume(page).evaluate((element) => getComputedStyle(element).backgroundImage);

for (const viewport of VIEWPORTS) {
  test(`a child builds, plays, debugs, saves and reopens a whole scene at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/kids");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // A fresh browser: language, explorer, Ori, and the map.
    await expect(page.getByRole("heading", { name: "¡Hola!" })).toBeVisible();
    await page.getByRole("button", { name: "Seguir", exact: true }).click();
    await page.getByRole("button", { name: "🐼" }).click();
    await page.getByRole("button", { name: "Seguir", exact: true }).click();
    await page.getByRole("button", { name: "¡Empezar!", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Mapa" })).toBeVisible();

    // Crear: a character and a backdrop, then the scene.
    await page.getByRole("button", { name: "Crear", exact: true }).click();
    const steps = page.getByRole("navigation", { name: "Pasos para crear" });
    await steps.getByRole("button", { name: /^2 ·/ }).click();
    await page.getByLabel("Fondos incluidos").getByRole("button", { name: "Arrecife" }).click();
    if (viewport.name === "phone") await steps.getByRole("button", { name: /^3 ·/ }).click();
    await page.getByRole("button", { name: "Crear escena", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Escena libre" })).toBeVisible();
    await expect(firstCostume(page)).toHaveAttribute("aria-label", "Nova");
    const novaImage = await costumeImage(page);

    // The first character: move, change costume, make a sound.
    const palette = page.locator(".kids-studio-palette");
    await page.getByRole("button", { name: "+ Mover", exact: true }).click();
    await palette
      .locator(".kids-palette-tool-looks")
      .filter({ has: page.getByRole("button", { name: "+ Cambiar disfraz", exact: true }) })
      .getByRole("combobox", { name: "Cambiar disfraz" })
      .selectOption("mika");
    await page.getByRole("button", { name: "+ Cambiar disfraz", exact: true }).click();
    await palette
      .locator(".kids-palette-tool-sound")
      .filter({ has: page.getByRole("button", { name: "+ Sonar", exact: true }) })
      .getByRole("button", { name: "Elegir y escuchar Campana" })
      .click();
    await page.getByRole("button", { name: "+ Sonar", exact: true }).click();
    await expect(blocksOf(page)).toContainText([
      "Mover",
      "Cambiar disfraz: Mika",
      "Sonar: Campana",
    ]);

    // A second character with its own event: it turns when it is tapped.
    await page.getByRole("button", { name: "+ Agregar personaje" }).click();
    await expect(page.getByRole("group", { name: "Personajes" }).getByRole("button")).toHaveCount(
      2,
    );
    await page.getByRole("combobox", { name: "Cuando" }).selectOption("onActorClicked");
    await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
    await expect(blocksOf(page)).toHaveCount(1);

    // Play: the first character moves and changes costume; the tap event waits for the child.
    await page.getByRole("button", { name: "Jugar", exact: true }).click();
    await expect(page.getByText("3 bloques ejecutados")).toBeVisible();
    await expect.poll(() => costumeImage(page)).not.toBe(novaImage);
    await stageActors(page).last().click();
    // The tap adds the turn block to the same run.
    await expect(page.getByText("4 bloques ejecutados")).toBeVisible();

    // Debug: Step shows the run block by block; Back to start clears it.
    await page.getByRole("button", { name: "Jugar", exact: true }).click();
    const stage = page.getByRole("group", { name: "Escenario" });
    const beforeStep = await stage.innerHTML();
    await page.getByRole("button", { name: "Paso", exact: true }).click();
    expect(await stage.innerHTML()).not.toBe(beforeStep);
    await page.getByRole("button", { name: "Volver al inicio" }).click();
    await expect(page.getByText(/bloques? ejecutados?/)).toHaveCount(0);

    // Save and reopen: a hard reload, then the scene from Mis proyectos, work intact.
    await reloadTo(page, "#/proyectos");
    await page.getByRole("button", { name: "Mis proyectos" }).click();
    const card = page.getByRole("article").filter({ hasText: "Escena libre" });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Jugar" }).click();
    await expect(page.getByRole("group", { name: "Personajes" }).getByRole("button")).toHaveCount(
      2,
    );
    await page.getByRole("group", { name: "Personajes" }).getByRole("button").first().click();
    await expect(blocksOf(page)).toContainText([
      "Mover",
      "Cambiar disfraz: Mika",
      "Sonar: Campana",
    ]);
    await page.getByRole("button", { name: "Jugar", exact: true }).click();
    await expect(page.getByText("3 bloques ejecutados")).toBeVisible();

    // Export the scene and bring it back: the same two characters and blocks.
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Exportar escena" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.agorix$/);
    const exported = await readFile(await download.path()!);
    await page.getByRole("button", { name: /Volver a (Mis proyectos|Crear)/ }).click();
    if (!(await page.getByLabel("Importar .agorix").count()))
      await page.getByRole("button", { name: "Mis proyectos" }).click();
    await page.getByLabel("Importar .agorix").setInputFiles({
      name: "escena.agorix",
      mimeType: "application/json",
      buffer: exported,
    });
    await expect(page.getByRole("heading", { name: "Escena libre" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Personajes" }).getByRole("button")).toHaveCount(
      2,
    );
    await page.getByRole("group", { name: "Personajes" }).getByRole("button").first().click();
    await expect(blocksOf(page)).toContainText([
      "Mover",
      "Cambiar disfraz: Mika",
      "Sonar: Campana",
    ]);
  });
}
