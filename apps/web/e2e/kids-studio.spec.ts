import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { evaluateOriStudioOutput, ORI_STUDIO_VERSION } from "@agorix/ori-agent";

test.use({ hasTouch: true, serviceWorkers: "block" });

test("free scene senses the stage edge and saves distance to a character after reopening", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
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
  await page.getByRole("button", { name: "+ Agregar personaje" }).click();
  await page.getByRole("group", { name: "Personajes" }).getByRole("button").first().click();
  await page.getByRole("textbox", { name: "Nombre" }).fill("Distancia");
  await page.getByRole("button", { name: "+ Crear variable" }).click();
  await page.getByRole("button", { name: "+ Guardar distancia" }).click();
  await page.getByRole("button", { name: "+ Si toca el borde, mover 1" }).click();
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("Distancia: 60")).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("La condición se cumplió: Sí");
  await expect(page.locator(".kids-studio-stage-actor").first()).toHaveAttribute(
    "style",
    /left: 18%/,
  );
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(page.locator(".kids-program-block")).toContainText([
    "Fijar valor",
    "Si tocando borde",
  ]);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("Distancia: 60")).toBeVisible();
});

test("free scene senses another character and records its own X position after reopening", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
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
  await page.getByRole("button", { name: "+ Agregar personaje" }).click();
  await page.getByRole("group", { name: "Personajes" }).getByRole("button").first().click();
  await page.getByRole("textbox", { name: "Nombre" }).fill("Lugar");
  await page.getByRole("button", { name: "+ Crear variable" }).click();
  await page.getByRole("spinbutton", { name: "Posición horizontal" }).fill("40");
  await page.getByRole("spinbutton", { name: "Posición vertical" }).fill("0");
  await page.getByRole("button", { name: "+ Ir a posición" }).click();
  await page.getByRole("button", { name: "+ Guardar posición X" }).click();
  await page.getByRole("button", { name: "+ Si toca, mover 1" }).click();
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("Lugar: 40")).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("La condición se cumplió: Sí");
  await expect(page.locator(".kids-studio-stage-actor").first()).toHaveAttribute(
    "style",
    /left: 28%/,
  );
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(page.locator(".kids-program-block")).toContainText([
    "Ir a posición: 40, 0",
    "Fijar valor",
    "Si",
  ]);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("Lugar: 40")).toBeVisible();
});

test("free scene moves to coordinates and stops sound after reopening", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
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
  await page.getByRole("spinbutton", { name: "Posición horizontal" }).fill("240");
  await page.getByRole("spinbutton", { name: "Posición vertical" }).fill("-40");
  await page.getByRole("button", { name: "+ Ir a posición" }).click();
  await page.getByRole("button", { name: "+ Sonar" }).click();
  await page.getByRole("button", { name: "+ Detener sonidos" }).click();
  await expect(page.locator(".kids-program-block")).toContainText([
    "Ir a posición: 240, -40",
    "Sonar",
    "Detener sonidos",
  ]);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.locator(".kids-studio-stage-actor").first()).toHaveAttribute(
    "style",
    /left: 68%/,
  );
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(page.locator(".kids-program-block")).toContainText([
    "Ir a posición: 240, -40",
    "Sonar",
    "Detener sonidos",
  ]);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("3 bloques ejecutados")).toBeVisible();
});

test("free scene grows and shrinks a character and keeps the size blocks after reopening", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
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
  await page.getByLabel("Cambiar tamaño").selectOption("50");
  await page.getByRole("button", { name: "+ Cambiar tamaño" }).click();
  await page.getByLabel("Cambiar tamaño").selectOption("-25");
  await page.getByRole("button", { name: "+ Cambiar tamaño" }).click();
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("Cambiar tamaño: +50%").first()).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(page.getByText("Cambiar tamaño: -25%").first()).toBeVisible();
});

test("free scene repeats blocks until the character reaches the edge and keeps the loop after reopening", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
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
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "Repetir hasta tocar el borde" }).click();
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText(/Repetir hasta/).first()).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(page.getByText(/Repetir hasta/).first()).toBeVisible();
});

test("free scene points at a friend, bounces off the edge and keeps the blocks after reopening", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
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
  await page.getByRole("button", { name: "+ Agregar personaje" }).click();
  await page.getByRole("button", { name: "+ Apuntar a" }).click();
  await page.getByLabel("Apuntar hacia").selectOption({ label: "izquierda" });
  await page.getByRole("button", { name: "+ Apuntar hacia" }).click();
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Rebotar en el borde" }).click();
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("Apuntar hacia: izquierda").first()).toBeVisible();
  await expect(page.getByText("Rebotar en el borde").first()).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(page.getByText("Rebotar en el borde").first()).toBeVisible();
});

test("free scene lets a child compose volume and show or hide a variable after reopening", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
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
  await page.getByRole("textbox", { name: "Nombre" }).fill("Puntos");
  await page.getByRole("button", { name: "+ Crear variable" }).click();
  await page.getByRole("spinbutton", { name: "Volumen", exact: true }).fill("40");
  await page.getByRole("button", { name: "+ Fijar volumen" }).click();
  await page.getByRole("spinbutton", { name: "Cambio de volumen" }).fill("-15");
  await page.getByRole("button", { name: "+ Cambiar volumen" }).click();
  await page.getByRole("button", { name: "+ Ocultar variable" }).click();
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("Volumen: 25%")).toBeVisible();
  await expect(page.getByText("Puntos: 0")).toHaveCount(0);
  await expect(page.getByText("Cambiar volumen: -15")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await page.getByRole("button", { name: "+ Mostrar variable" }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("Puntos: 0")).toBeVisible();
});

test("free scene inserts and replaces list items and uses bounded seeded random", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
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
  await page.getByRole("textbox", { name: "Nombre" }).fill("Dado");
  await page.getByRole("button", { name: "+ Crear variable" }).click();
  await page.getByRole("textbox", { name: "Nombre" }).fill("Números");
  await page.getByRole("button", { name: "+ Crear lista" }).click();
  await page.getByRole("spinbutton", { name: "Número" }).fill("2");
  await page.getByRole("button", { name: "+ Agregar número" }).click();
  await page.getByRole("spinbutton", { name: "Número" }).fill("4");
  await page.getByRole("button", { name: "+ Insertar número" }).click();
  await page.getByRole("spinbutton", { name: "Posición (desde 1)" }).fill("2");
  await page.getByRole("spinbutton", { name: "Número" }).fill("6");
  await page.getByRole("button", { name: "+ Cambiar elemento" }).click();
  await page.getByRole("spinbutton", { name: "Azar desde" }).fill("3");
  await page.getByRole("spinbutton", { name: "Azar hasta" }).fill("3");
  await page.getByRole("button", { name: "+ Guardar azar en variable" }).click();
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("Números: 4, 6")).toBeVisible();
  await expect(page.getByText("Dado: 3")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(page.getByText("Insertar número: Números 1 ← 4")).toBeVisible();
  await expect(page.getByText("Cambiar elemento: Números 2 ← 6")).toBeVisible();
});

test("free scene exposes bounded list reading, length and removal", async ({ page }) => {
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
  await page.getByRole("textbox", { name: "Nombre" }).fill("Cuenta");
  await page.getByRole("button", { name: "+ Crear variable" }).click();
  await page.getByRole("textbox", { name: "Nombre" }).fill("Cosas");
  await page.getByRole("button", { name: "+ Crear lista" }).click();
  await page.getByRole("spinbutton", { name: "Número" }).fill("7");
  await page.getByRole("button", { name: "+ Agregar número" }).click();
  await page.getByRole("button", { name: "+ Leer elemento en variable" }).click();
  await page.getByRole("button", { name: "+ Guardar largo en variable" }).click();
  await page.getByRole("button", { name: "+ Quitar elemento" }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("Cuenta: 1")).toBeVisible();
  await expect(page.getByText("Cosas: —")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(page.getByText("Quitar elemento: Cosas 1")).toBeVisible();
});

test("a child adds local costume and backdrop images to a free scene", async ({ page }) => {
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
  const fixture = resolve("e2e/fixtures/kids-solid.png");
  await page.getByLabel("Agregar disfraz desde imagen").setInputFiles(fixture);
  await expect(page.getByRole("group", { name: "Mis disfraces" })).toContainText("Mi disfraz 1");
  await page.getByLabel("Agregar fondo desde imagen").setInputFiles(fixture);
  await expect(page.getByRole("group", { name: "Mis fondos" })).toContainText("Mi fondo 2");
  await expect(page.locator(".kids-studio-stage-actor .kids-art-image")).toHaveCSS(
    "background-image",
    /data:image/,
  );
  await expect(page.locator(".kids-studio-stage")).toHaveCSS("background-image", /data:image/);
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(page.getByRole("group", { name: "Mis disfraces" })).toContainText("Mi disfraz 1");
  await expect(page.locator(".kids-studio-stage")).toHaveCSS("background-image", /data:image/);
});

test("drawn costume and backdrop survive adult-approved export and import", async ({ page }) => {
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
  await page.getByRole("button", { name: "Dibujar disfraz" }).click();
  const costumeCanvas = page.getByRole("img", { name: "Lienzo para dibujar" });
  await costumeCanvas.scrollIntoViewIfNeeded();
  const bounds = await costumeCanvas.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.click(bounds!.x + 80, bounds!.y + 80);
  await page.getByRole("button", { name: "Guardar dibujo" }).click();
  await expect(page.getByRole("group", { name: "Mis disfraces" })).toBeVisible();
  await expect(page.locator(".kids-studio-stage-actor .kids-art-image")).toHaveCSS(
    "background-image",
    /data:image/,
  );
  const firstCostume = await page
    .locator(".kids-studio-stage-actor .kids-art-image")
    .evaluate((element) => getComputedStyle(element).backgroundImage);
  await page.getByRole("button", { name: "Editar Mi disfraz 1" }).click();
  await expect(costumeCanvas).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardar dibujo" })).toBeEnabled();
  await page.getByRole("button", { name: "Color #ef627d" }).click();
  await costumeCanvas.scrollIntoViewIfNeeded();
  const editBounds = await costumeCanvas.boundingBox();
  expect(editBounds).not.toBeNull();
  await page.mouse.click(editBounds!.x + 120, editBounds!.y + 120);
  await page.getByRole("button", { name: "Guardar dibujo" }).click();
  await expect
    .poll(() =>
      page
        .locator(".kids-studio-stage-actor .kids-art-image")
        .evaluate((element) => getComputedStyle(element).backgroundImage),
    )
    .not.toBe(firstCostume);
  await page.getByRole("button", { name: "Dibujar fondo" }).click();
  await page.getByRole("button", { name: "Guardar dibujo" }).click();
  await expect(page.getByRole("group", { name: "Mis fondos" })).toBeVisible();
  await expect(page.locator(".kids-studio-stage")).toHaveCSS("background-image", /data:image/);
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  const card = page.getByRole("article").filter({ hasText: "Escena libre" });
  await card.getByRole("button", { name: "Exportar" }).click();
  await expect(page.getByRole("dialog")).toContainText("Solo para adultos");
  await page.getByRole("dialog").getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "2", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Comprobar" }).click();
  await expect(page.getByRole("dialog")).toContainText("Este archivo incluirá los dibujos");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Incluir imágenes y exportar" }).click(),
  ]);
  const source = await readFile(await download.path()!, "utf8");
  expect(JSON.parse(source).formatVersion).toBe("2");
  await page.getByLabel("Importar .agorix").setInputFiles({
    name: "escena.agorix",
    mimeType: "application/json",
    buffer: Buffer.from(source),
  });
  await expect(page.getByRole("heading", { name: "Escena libre" })).toBeVisible();
  await expect(page.locator(".kids-studio-stage-actor .kids-art-image")).toHaveCSS(
    "background-image",
    /data:image/,
  );
  await expect(page.locator(".kids-studio-stage")).toHaveCSS("background-image", /data:image/);
});

test("a child places a character and the stage keeps that position after reopening", async ({
  page,
}) => {
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
  const actor = page.getByRole("group", { name: "Escenario" }).getByRole("button").first();
  await expect(actor).toHaveCSS("left", /%|px/);
  const before = await actor.getAttribute("style");
  await page.getByRole("button", { name: "Ubicar personaje →" }).click();
  const placed = await actor.getAttribute("style");
  expect(placed).not.toBe(before);
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(
    page.getByRole("group", { name: "Escenario" }).getByRole("button").first(),
  ).toHaveAttribute("style", placed!);
});

test("a child drags the selected character and changes its layer", async ({ page }) => {
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
  await page.getByRole("button", { name: "+ Agregar personaje" }).click();
  await page.getByRole("group", { name: "Personajes" }).getByRole("button").first().click();
  const first = page.getByRole("group", { name: "Escenario" }).getByRole("button").first();
  const before = await first.getAttribute("style");
  await first.scrollIntoViewIfNeeded();
  const bounds = await first.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width / 2 + 40, bounds!.y + bounds!.height / 2 + 20, {
    steps: 5,
  });
  await expect(first).not.toHaveAttribute("style", before!);
  await page.mouse.up();
  const moved = await first.getAttribute("style");
  expect(moved).not.toBe(before);
  await page.getByRole("button", { name: "Traer adelante" }).click();
  await expect(first).toHaveCSS("z-index", "2");
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(
    page.getByRole("group", { name: "Escenario" }).getByRole("button").first(),
  ).toHaveAttribute("style", moved!.replace(/z-index: \d+;/, "z-index: 2;"));
});

test("free scene keeps independent character scripts and reopens the saved stage", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
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
  await expect(page.getByRole("heading", { name: "Escena libre" })).toBeVisible();
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await page.getByRole("button", { name: "+ Mover" }).click();
  await page.getByRole("button", { name: "+ Agregar personaje" }).click();
  await expect(page.getByRole("group", { name: "Personajes" }).getByRole("button")).toHaveCount(2);
  await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
  await page.getByRole("group", { name: "Personajes" }).getByRole("button").first().click();
  await expect(page.locator(".kids-program-block")).toContainText("Mover 1");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("2 bloques ejecutados")).toBeVisible();
  await expect(page.locator(".kids-ori-action")).toHaveAttribute("data-ori-state", "observing");
  await page.getByRole("button", { name: "Pedirle una idea a Ori" }).click();
  await expect(page.getByText("Ori tiene una idea para mirar y decidir.")).toBeVisible();
  await page.getByRole("button", { name: "Usar idea" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(2);
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(page.getByRole("group", { name: "Personajes" }).getByRole("button")).toHaveCount(2);
  await expect(page.locator(".kids-program-block")).toContainText("Mover 1");
});

test("looks and wait blocks change only the chosen character and survive reload", async ({
  page,
}) => {
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
  await page.getByRole("button", { name: "+ Agregar personaje" }).click();
  await page.getByRole("textbox", { name: "Decir / Pensar" }).fill("Hola, Nova");
  await page.getByRole("button", { name: "+ Decir" }).click();
  await page.getByRole("button", { name: "+ Esperar" }).click();
  await page.getByRole("button", { name: "+ Esconder" }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByRole("group", { name: "Escenario" }).getByRole("button")).toHaveCount(1);
  await page.getByRole("button", { name: "Paso" }).click();
  await expect(page.locator(".kids-studio-bubble")).toHaveText("Hola, Nova");
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await page.getByRole("group", { name: "Personajes" }).getByRole("button").last().click();
  await expect(page.locator(".kids-program-block")).toHaveCount(3);
});

test("a tapped character runs its own event script after Play", async ({ page }) => {
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
  await page.getByRole("button", { name: "+ Agregar personaje" }).click();
  await page.getByRole("combobox", { name: "Cuando" }).selectOption("onActorClicked");
  await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("0 bloques ejecutados")).toBeVisible();
  await page.getByRole("group", { name: "Escenario" }).getByRole("button").last().click();
  await expect(page.getByText("1 bloque ejecutado")).toBeVisible();
});

test("Ori's server idea is reviewed before it changes a free scene", async ({ page }) => {
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
  const requests: unknown[] = [];
  await page.route("**/api/tutor/studio/ori", async (route) => {
    const context = route.request().postDataJSON();
    requests.push(context);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const decision = evaluateOriStudioOutput(context, {
      version: ORI_STUDIO_VERSION,
      kind: "program-suggestion",
      actorId: context.actorId,
      block: { type: "turn", degrees: -90 },
    });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ message: decision.message, proposal: decision.proposal }),
    });
  });
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  await page.getByRole("button", { name: "Pedirle una idea a Ori" }).click();
  await expect(page.locator(".kids-ori-action")).toHaveAttribute("data-ori-state", "thinking");
  await expect(
    page.getByText("Ori tiene una idea para tu escena.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".kids-ori-action")).toHaveAttribute("data-ori-state", "proposal");
  await expect(page.locator(".kids-program-block")).toHaveCount(0);
  await page.getByRole("button", { name: "Usar idea" }).click();
  await expect(page.locator(".kids-program-block")).toContainText("Girar a la izquierda");
  expect(requests).toHaveLength(1);
  expect(JSON.stringify(requests[0])).toContain("actor:studio-1-nova");
});

test("the adult Ori switch hides scene suggestions", async ({ page }) => {
  await page.goto("/kids");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
    localStorage.setItem(
      "agorix.kids.adults.v1",
      JSON.stringify({
        oriSuggestions: false,
        readAloud: true,
        dailyLimitMinutes: 30,
        ageBand: "6-8",
      }),
    );
  });
  await page.reload();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  await expect(page.getByRole("button", { name: "Pedirle una idea a Ori" })).toHaveCount(0);
});

test("free scene composes data, repeat, message and key events in a fresh session", async ({
  page,
}) => {
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
  await page.getByRole("textbox", { name: "Nombre" }).fill("Puntos");
  await page.getByRole("button", { name: "+ Crear variable" }).click();
  await page.getByRole("textbox", { name: "Nombre" }).fill("Tesoros");
  await page.getByRole("button", { name: "+ Crear lista" }).click();
  await page.getByRole("spinbutton", { name: "Número" }).fill("2");
  await page.getByRole("button", { name: "+ Fijar valor" }).click();
  await page.getByRole("button", { name: "+ Agregar número" }).click();
  await page.getByRole("spinbutton", { name: "Número" }).fill("1");
  await page.getByRole("button", { name: /\+ Si .* → mover 1/ }).click();
  await page.getByRole("button", { name: "+ Repetir", exact: false }).click();
  await page.getByRole("button", { name: "+ Enviar mensaje" }).click();
  await page.getByRole("button", { name: "+ Agregar personaje" }).click();
  await page.getByRole("combobox", { name: "Cuando" }).selectOption("onMessage");
  await page.getByRole("button", { name: "+ Mover" }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("group", { name: "Personajes" }).getByRole("button").first().click();
  await expect(page.getByText("Puntos: 2")).toBeVisible();
  await expect(page.getByText("Tesoros: 2")).toBeVisible();
  await expect(page.getByText("10 bloques ejecutados")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await page.getByRole("group", { name: "Personajes" }).getByRole("button").last().click();
  await expect(page.getByRole("combobox", { name: "Cuando" })).toHaveValue("onMessage");
  await page.getByRole("combobox", { name: "Cuando" }).selectOption("onKeyPressed");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("button", { name: "Pulsar tecla: Space" }).click();
  await expect(page.getByText(/bloques ejecutados/)).toBeVisible();
});

test("free scene sends a character to the front or back and keeps the blocks after reopening", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
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
  await page.getByRole("button", { name: "+ Agregar personaje" }).click();
  await page.getByRole("button", { name: "+ Pasar al frente" }).click();
  await page.getByRole("button", { name: "+ Pasar al fondo" }).click();
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("Pasar al frente").first()).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(page.locator(".kids-program-block").last()).toContainText("Pasar al fondo");
});

test("free scene rounds a divided value and keeps the block after reopening", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
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
  await page.getByRole("textbox", { name: "Nombre" }).fill("Medio");
  await page.getByRole("button", { name: "+ Crear variable" }).click();
  await page.getByRole("spinbutton", { name: "Número" }).fill("7");
  await page.getByRole("button", { name: "+ Fijar valor" }).click();
  await page.getByRole("spinbutton", { name: "Número" }).fill("2");
  await page.getByRole("combobox", { name: "Operación" }).selectOption("divide");
  await page.getByRole("button", { name: "+ Fijar con cálculo" }).click();
  await page.getByRole("combobox", { name: "Función" }).selectOption("round");
  await page.getByRole("button", { name: "+ Fijar con función" }).click();
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("Medio: 4")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(page.locator(".kids-program-block").last()).toContainText("round(Medio)");
});

test("free scene computes a remainder and keeps the block after reopening", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
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
  await page.getByRole("textbox", { name: "Nombre" }).fill("Resto");
  await page.getByRole("button", { name: "+ Crear variable" }).click();
  await page.getByRole("spinbutton", { name: "Número" }).fill("7");
  await page.getByRole("button", { name: "+ Fijar valor" }).click();
  await page.getByRole("spinbutton", { name: "Número" }).fill("3");
  await page.getByRole("combobox", { name: "Operación" }).selectOption("modulo");
  await page.getByRole("button", { name: "+ Fijar con cálculo" }).click();
  await page.getByRole("spinbutton", { name: "Número" }).fill("0");
  await expect(page.getByRole("button", { name: "+ Fijar con cálculo" })).toBeDisabled();
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("Resto: 1")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(page.locator(".kids-program-block").last()).toContainText("Resto mod 3");
});

test("free scene groups several blocks and runs a child-composed calculation", async ({ page }) => {
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
  await page.getByRole("textbox", { name: "Nombre" }).fill("Puntos");
  await page.getByRole("button", { name: "+ Crear variable" }).click();
  await page.getByRole("spinbutton", { name: "Número" }).fill("2");
  await page.getByRole("button", { name: "+ Fijar valor" }).click();
  await page.getByRole("button", { name: "+ Retroceder" }).click();
  await page.getByRole("combobox", { name: "Grados" }).selectOption("45");
  await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
  await page.getByRole("button", { name: "Repetir estos bloques" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(2);
  await expect(page.locator(".kids-program-block").last()).toContainText("Retroceder 1");
  await expect(page.locator(".kids-program-block").last()).toContainText("Girar a la derecha 45°");
  await page.getByRole("spinbutton", { name: "Número" }).fill("3");
  await page.getByRole("button", { name: "+ Fijar con cálculo" }).click();
  await page.getByRole("button", { name: "+ Mover" }).click();
  await page.getByRole("combobox", { name: "Comparar" }).selectOption("lessThan");
  await page.getByRole("spinbutton", { name: "Número" }).fill("6");
  await page.getByRole("button", { name: "Si se cumple, ejecutar estos bloques" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(3);
  await expect(page.locator(".kids-program-block").last()).toContainText("Puntos + 3");
  await expect(page.locator(".kids-program-block").last()).toContainText("Mover 1");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("Puntos: 5")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(page.locator(".kids-program-block")).toHaveCount(3);
  await expect(page.locator(".kids-code-strip")).toContainText("Puntos");
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
});
