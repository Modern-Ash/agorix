import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import {
  createOriStudioInput,
  evaluateOriStudioOutput,
  ORI_STUDIO_VERSION,
} from "@agorix/ori-agent";
import { reloadTo } from "./helpers.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

test("free scene records stage pointer for mouse sensors without storing it in the project", async ({
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
  await page.getByRole("textbox", { name: "Nombre" }).fill("Ratón");
  await page.getByRole("button", { name: "+ Crear variable" }).click();
  await page.getByRole("button", { name: "+ Guardar X del ratón" }).click();
  await page.getByRole("button", { name: "+ Si el ratón está pulsado, mover 1" }).click();
  const stage = page.getByRole("group", { name: "Escenario" });
  await stage.scrollIntoViewIfNeeded();
  const box = await stage.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("Ratón: 168")).toBeVisible();
  await stage.scrollIntoViewIfNeeded();
  const activeBox = await stage.boundingBox();
  expect(activeBox).not.toBeNull();
  const actor = stage.locator(".kids-studio-stage-actor").first();
  const idleLeft = await actor.evaluate((element) => (element as HTMLElement).style.left);
  await page.mouse.move(
    activeBox!.x + activeBox!.width * 0.5,
    activeBox!.y + activeBox!.height * 0.5,
  );
  await page.mouse.down();
  await expect
    .poll(() => actor.evaluate((element) => (element as HTMLElement).style.left))
    .not.toBe(idleLeft);
  await page.mouse.up();
  await expect
    .poll(() => actor.evaluate((element) => (element as HTMLElement).style.left))
    .toBe(idleLeft);
  await page.touchscreen.tap(
    activeBox!.x + activeBox!.width * 0.25,
    activeBox!.y + activeBox!.height * 0.5,
  );
  await expect(page.getByText("Ratón: 68")).toBeVisible();
  await reloadTo(page, "#/proyectos");
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(page.locator(".kids-program-block")).toContainText([
    "Fijar valor",
    "Si ratón pulsado",
  ]);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("Ratón: 0")).toBeVisible();
});

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
  await reloadTo(page, "#/proyectos");
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
  await reloadTo(page, "#/proyectos");
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
  await reloadTo(page, "#/proyectos");
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

test("free scene makes, uses, reopens and deletes a custom block", async ({ page }) => {
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
  await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
  await page.getByRole("textbox", { name: "Título del bloque" }).fill("Cuadrado");
  await page.getByRole("button", { name: "Crear bloque con estos bloques" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
  await expect(page.locator(".kids-program-block").first()).toContainText("Usar: Cuadrado");
  await page.getByRole("button", { name: "+ Usar: Cuadrado" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(2);
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await reloadTo(page, "#/proyectos");
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(page.locator(".kids-program-block")).toHaveCount(2);
  await expect(page.locator(".kids-program-block").last()).toContainText("Usar: Cuadrado");
  await page.getByRole("button", { name: "Borrar bloque: Cuadrado" }).click();
  await expect(page.getByText("Este bloque se usa 2 veces.")).toBeVisible();
  await page.getByRole("button", { name: "Conservar" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(2);
  await page.getByRole("button", { name: "Borrar bloque: Cuadrado" }).click();
  await page.getByRole("button", { name: "Reemplazar usos y borrar" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(4);
  await expect(page.locator(".kids-program-block").first()).toContainText("Mover");
  await expect(page.getByRole("textbox", { name: "Cambiar nombre: Cuadrado" })).toHaveCount(0);
});

test("free scene gives a custom block a number, picks it per use and keeps it after reopening", async ({
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
  await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
  await page.getByRole("textbox", { name: "Título del bloque" }).fill("Paso");
  await page.getByRole("textbox", { name: "Título del número" }).first().fill("Largo");
  await page.getByRole("button", { name: "Añadir número", exact: true }).click();
  await page.getByRole("button", { name: "Crear bloque con estos bloques" }).click();
  await expect(page.locator(".kids-program-block").first()).toContainText("Usar: Paso (Largo: 0)");
  await page.getByRole("combobox", { name: /^Valor de: Mover/ }).selectOption("p1");
  await expect(page.locator(".kids-program-block").first()).toContainText("Largo: 40");
  await page.getByRole("combobox", { name: /^Número Largo/ }).selectOption("100");
  await expect(page.locator(".kids-program-block").first()).toContainText("Largo: 100");
  await page.getByRole("button", { name: "+ Usar: Paso" }).click();
  await expect(page.locator(".kids-program-block").last()).toContainText("Largo: 40");
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await reloadTo(page, "#/proyectos");
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(page.locator(".kids-program-block").first()).toContainText("Largo: 100");
  await expect(page.locator(".kids-program-block").last()).toContainText("Largo: 40");
});

test("free scene hands a block number on to another block and keeps it after reopening", async ({
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
  await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
  await page.getByRole("textbox", { name: "Título del bloque" }).fill("Paso");
  await page.getByRole("textbox", { name: "Título del número" }).first().fill("Largo");
  await page.getByRole("button", { name: "Añadir número", exact: true }).click();
  await page.getByRole("button", { name: "Crear bloque con estos bloques" }).click();
  await page.getByRole("combobox", { name: /^Valor de: Mover/ }).selectOption("p1");
  await page.getByRole("button", { name: "+ Usar: Paso" }).click();
  await page.getByRole("textbox", { name: "Título del bloque" }).fill("Doble");
  await page.getByRole("textbox", { name: "Título del número" }).first().fill("Base");
  await page.getByRole("button", { name: "Añadir número", exact: true }).click();
  await page.getByRole("button", { name: "Crear bloque con estos bloques" }).click();
  const doble = page.locator(".kids-studio-my-blocks li").filter({ hasText: "Doble" }).first();
  const pickers = doble.getByRole("combobox", { name: /^Número Largo \(Paso\)/ });
  await expect(pickers).toHaveCount(2);
  await pickers.nth(0).selectOption("p1");
  await pickers.nth(1).selectOption("p1");
  await expect(doble).toContainText("Largo: Base");
  await page.getByRole("combobox", { name: /^Número Base/ }).selectOption("100");
  await expect(page.locator(".kids-program-block").first()).toContainText("Base: 100");
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await reloadTo(page, "#/proyectos");
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(page.locator(".kids-program-block").first()).toContainText("Base: 100");
  await expect(
    page.locator(".kids-studio-my-blocks li").filter({ hasText: "Doble" }).first(),
  ).toContainText("Largo: Base");
});

test("free scene copies a custom block to another character and keeps both after reopening", async ({
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
  const actors = page.getByRole("group", { name: "Personajes" }).getByRole("button");
  await actors.first().click();
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
  await page.getByRole("textbox", { name: "Título del bloque" }).fill("Paso");
  await page.getByRole("textbox", { name: "Título del número" }).first().fill("Largo");
  await page.getByRole("button", { name: "Añadir número", exact: true }).click();
  await page.getByRole("button", { name: "Crear bloque con estos bloques" }).click();
  await page.getByRole("button", { name: "Copiar bloque a: Paso" }).click();
  await actors.nth(1).click();
  await expect(page.locator(".kids-studio-my-blocks li").filter({ hasText: "Paso" })).toHaveCount(
    1,
  );
  await page.getByRole("button", { name: "+ Usar: Paso" }).click();
  await expect(page.locator(".kids-program-block").first()).toContainText("Usar: Paso (Largo:");
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await reloadTo(page, "#/proyectos");
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await actors.nth(1).click();
  await expect(page.locator(".kids-program-block").first()).toContainText("Usar: Paso");
  await actors.first().click();
  await expect(page.locator(".kids-studio-my-blocks li").filter({ hasText: "Paso" })).toHaveCount(
    1,
  );
});

test("free scene senses a held key and the timer, and keeps both after reopening", async ({
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
  await page.getByLabel("Tecla a sentir").selectOption("ArrowRight");
  await page.getByRole("button", { name: "+ Si la tecla está pulsada, mover 1" }).click();
  await page.getByRole("button", { name: "+ Esperar", exact: true }).click();
  await page.getByLabel("Segundos del temporizador").selectOption("2");
  await page.getByRole("button", { name: /^Repetir hasta pasar los segundos/ }).click();
  await expect(page.locator(".kids-program-block").first()).toContainText("tiempo");
  await page.getByRole("checkbox", { name: "ArrowRight" }).check();
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText(/bloques ejecutados/).first()).toBeVisible();
  await reloadTo(page, "#/proyectos");
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(page.locator(".kids-program-block").first()).toContainText(
    "tecla ArrowRight pulsada",
  );
  await expect(page.locator(".kids-program-block").last()).toContainText("tiempo");
});

test("free scene draws with the pen extension and keeps the drawing blocks after reopening", async ({
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
  await page.getByLabel("Color del lápiz").selectOption("red");
  await page.getByRole("button", { name: "+ Color del lápiz" }).click();
  await page.getByRole("button", { name: "+ Bajar el lápiz" }).click();
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Subir el lápiz" }).click();
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.locator(".kids-studio-pen line").first()).toHaveAttribute("stroke", "#ef627d");
  expect(await page.locator(".kids-studio-pen line").count()).toBeGreaterThanOrEqual(3);
  await reloadTo(page, "#/proyectos");
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(page.locator(".kids-program-block").first()).toContainText("Color del lápiz: rojo");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.locator(".kids-studio-pen line").last()).toHaveAttribute("stroke", "#ef627d");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("Ori's face follows real events and respects reduced motion", async ({ page }) => {
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
  const face = page.locator(".kids-studio-ori .kids-ori-stage .kids-ori-face");
  // Nothing happened yet: Ori is calm, not pleased or busy.
  await expect(face).toHaveAttribute("data-ori-expression", "neutral");
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(face).toHaveAttribute("data-ori-expression", "happy");
  await page.getByRole("button", { name: "Pedirle una idea a Ori" }).click();
  await expect(page.getByText("Ori tiene una idea para mirar y decidir.")).toBeVisible();
  await expect(face).toHaveAttribute("data-ori-expression", "curious");
  await page.getByRole("button", { name: "Usar idea" }).click();
  await expect(face).toHaveAttribute("data-ori-expression", "happy");
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  // Reduced motion keeps the expression but removes every animation.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const animations = await page
    .locator(
      ".kids-studio-ori .kids-ori-stage .kids-ori-face, .kids-studio-ori .kids-ori-stage .kids-ori-face *",
    )
    .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).animationName));
  expect(animations.every((name) => name === "none")).toBe(true);
  await expect(face).toHaveAttribute("data-ori-expression", /happy|neutral/);
});

test("Ori's idea is previewed as a ghost block with real runtime evidence before it is used", async ({
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
  await expect(page.getByTestId("ori-ghost-block")).toHaveCount(0);
  await page.getByRole("button", { name: "Pedirle una idea a Ori" }).click();
  await expect(page.getByText("Ori tiene una idea para mirar y decidir.")).toBeVisible();
  // The idea is shown but not part of the program yet.
  await expect(page.getByTestId("ori-ghost-block")).toHaveCount(1);
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
  const evidence = page.getByTestId("ori-evidence");
  await expect(evidence).toContainText("Ahora termina en");
  await expect(evidence).toContainText("Con la idea terminaría en");
  await expect(evidence).toContainText("bloques");
  // Rejecting leaves the program untouched and removes the preview.
  await page.getByRole("button", { name: "No usar" }).click();
  await expect(page.getByTestId("ori-ghost-block")).toHaveCount(0);
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
  // Using it makes it a real block and the preview disappears.
  await page.getByRole("button", { name: "Pedirle una idea a Ori" }).click();
  await expect(page.getByTestId("ori-ghost-block")).toHaveCount(1);
  await page.getByRole("button", { name: "Usar idea" }).click();
  await expect(page.getByTestId("ori-ghost-block")).toHaveCount(0);
  await expect(page.locator(".kids-program-block")).toHaveCount(2);
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
});

async function openStudio(page: import("@playwright/test").Page, band: string) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/kids");
  await page.evaluate((ageBand) => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem("agorix.kids.flags.v1", JSON.stringify(["ageBands", "customImages"]));
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
    localStorage.setItem(
      "agorix.kids.adults.v1",
      JSON.stringify({ oriSuggestions: true, readAloud: true, dailyLimitMinutes: 30, ageBand }),
    );
  }, band);
  await page.reload();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
}

test("a goal from the closed list becomes several ghost blocks and only changes the program when used", async ({
  page,
}) => {
  // The 9–12 band offers every goal; the 6–8 band keeps Ori's ideas to six blocks (issue #607).
  await openStudio(page, "9-12");
  await page.getByRole("button", { name: "Hacer un cuadrado" }).click();
  await expect(page.getByTestId("intent-card")).toContainText("Ori propone 8 bloques");
  await expect(page.getByTestId("ori-ghost-block")).toHaveCount(8);
  await expect(page.locator(".kids-program-block")).toHaveCount(0);
  await expect(page.getByTestId("ori-evidence")).toContainText("Con la idea terminaría en");
  await page.getByTestId("intent-card").getByRole("button", { name: "No usar" }).click();
  await expect(page.getByTestId("ori-ghost-block")).toHaveCount(0);
  await expect(page.locator(".kids-program-block")).toHaveCount(0);
  await page.getByRole("button", { name: "Ir y volver" }).click();
  await page.getByTestId("intent-card").getByRole("button", { name: "Usar idea" }).click();
  await expect(page.getByTestId("ori-ghost-block")).toHaveCount(0);
  await expect(page.locator(".kids-program-block")).toHaveCount(6);
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(0);
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
});

test("Ori checks a prediction and explains the run from its trace, by age band", async ({
  page,
}) => {
  await openStudio(page, "6-8");
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("radio", { name: "a la izquierda" }).check();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  const coach = page.getByRole("region", { name: "Qué pasó" });
  await expect(coach).toContainText("ejecutó 1 bloque");
  await expect(page.getByTestId("coach-prediction")).toContainText("pero fue a la derecha");
  await expect(coach.getByRole("group", { name: "¿Pasó lo que esperabas?" })).toBeVisible();
  await coach.getByRole("button", { name: "No", exact: true }).click();
  await expect(page.getByTestId("coach-reply")).toContainText("Miremos juntos");
  // Without a prediction nothing is judged.
  await page.getByRole("button", { name: "No sé, probemos" }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByTestId("coach-prediction")).toHaveCount(0);
});

for (const [band, question] of [
  ["9-12", "¿Qué bloque movió a"],
  ["13+", "¿Cuántos bloques se ejecutaron en total?"],
] as const) {
  test(`the reflection question for ${band} comes from the run`, async ({ page }) => {
    await openStudio(page, band);
    await page.getByRole("button", { name: "+ Mover", exact: true }).click();
    await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
    await page.getByRole("button", { name: "Jugar", exact: true }).click();
    const coach = page.getByRole("region", { name: "Qué pasó" });
    await expect(coach).toContainText(question);
    if (band === "9-12") {
      await coach.getByRole("button", { name: "Girar", exact: true }).click();
      await expect(page.getByTestId("coach-reply")).toContainText("se movió con");
      await coach.getByRole("button", { name: "Mover", exact: true }).click();
      await expect(page.getByTestId("coach-reply")).toContainText("movió a");
    } else {
      await coach.getByRole("button", { name: "2", exact: true }).click();
      await expect(page.getByTestId("coach-reply")).toContainText("Eso es");
    }
  });
}

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
  await reloadTo(page, "#/proyectos");
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
  await expect(
    page.locator(".kids-program-block > span", { hasText: /^Repetir hasta/ }).first(),
  ).toBeVisible();
  await reloadTo(page, "#/proyectos");
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(
    page.locator(".kids-program-block > span", { hasText: /^Repetir hasta/ }).first(),
  ).toBeVisible();
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
  await reloadTo(page, "#/proyectos");
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
  await reloadTo(page, "#/proyectos");
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
  await reloadTo(page, "#/proyectos");
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
  await reloadTo(page, "#/proyectos");
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
  await reloadTo(page, "#/proyectos");
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
  await reloadTo(page, "#/proyectos");
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
  await reloadTo(page, "#/proyectos");
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
  await reloadTo(page, "#/proyectos");
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
  await reloadTo(page, "#/proyectos");
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
  await page.getByRole("button", { name: "+ Esperar", exact: true }).click();
  await page.getByRole("button", { name: "+ Esconder" }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByRole("group", { name: "Escenario" }).getByRole("button")).toHaveCount(1);
  await page.getByRole("button", { name: "Paso" }).click();
  await expect(page.locator(".kids-studio-bubble")).toHaveText("Hola, Nova");
  await reloadTo(page, "#/proyectos");
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

test("Ori proposes a custom block with numbers and the child reviews the values", async ({
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
  const requests: unknown[] = [];
  await page.route("**/api/tutor/studio/ori", async (route) => {
    const context = route.request().postDataJSON();
    requests.push(createOriStudioInput(context));
    const decision = evaluateOriStudioOutput(context, {
      version: ORI_STUDIO_VERSION,
      kind: "program-suggestion",
      actorId: context.actorId,
      block: { type: "callProcedure", procedureId: "proc-1-1", args: [100] },
    });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ message: decision.message, proposal: decision.proposal }),
    });
  });
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
  await page.getByRole("textbox", { name: "Título del bloque" }).fill("Paso");
  await page.getByRole("textbox", { name: "Título del número" }).first().fill("Largo");
  await page.getByRole("button", { name: "Añadir número", exact: true }).click();
  await page.getByRole("button", { name: "Crear bloque con estos bloques" }).click();
  await page.getByRole("combobox", { name: /^Valor de: Mover/ }).selectOption("p1");

  // A second block whose number is a turn, so changing the idea needs degree defaults.
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Girar a la izquierda" }).click();
  await page.getByRole("textbox", { name: "Título del bloque" }).fill("Vuelta");
  await page.getByRole("textbox", { name: "Título del número" }).first().fill("Ancho");
  await page.getByRole("button", { name: "Añadir número", exact: true }).click();
  await page.getByRole("button", { name: "Crear bloque con estos bloques" }).click();
  await page.getByRole("combobox", { name: /^Valor de: Girar a la izquierda/ }).selectOption("p1");

  await page.getByRole("button", { name: "Pedirle una idea a Ori" }).click();
  await expect(page.locator(".kids-ori-proposal strong")).toHaveText("+ Usar: Paso (Largo: 100)");
  const request = JSON.stringify(requests[0]);
  expect(request).toContain('"unit":"steps"');
  expect(request).toContain('"unit":"degrees"');
  expect(request).toContain('"choices"');
  expect(request).not.toMatch(/Paso|Vuelta|Largo|Ancho/);

  // Changing to the other numbered block uses its default value instead of an invalid call.
  await page.getByRole("button", { name: "Cambiar idea" }).click();
  await expect(page.locator(".kids-program-block").last()).toContainText(
    "Usar: Vuelta (Ancho: 90)",
  );
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
  await reloadTo(page, "#/proyectos");
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

test("free scene glides to a position and keeps the block after reopening", async ({ page }) => {
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
  await page.getByRole("combobox", { name: "Esperar" }).selectOption("2");
  await page.getByRole("button", { name: "+ Deslizar a posición" }).click();
  await expect(page.locator(".kids-program-block")).toContainText([
    "Deslizar a posición: 240, -40 (2s)",
  ]);
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.locator(".kids-studio-stage-actor").first()).toHaveAttribute(
    "style",
    /left: 68%/,
  );
  await reloadTo(page, "#/proyectos");
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(page.locator(".kids-program-block")).toContainText([
    "Deslizar a posición: 240, -40 (2s)",
  ]);
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
  await reloadTo(page, "#/proyectos");
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
  await reloadTo(page, "#/proyectos");
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
  await reloadTo(page, "#/proyectos");
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
  await reloadTo(page, "#/proyectos");
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

test("Ori suggests using a block the child made; the child reviews, changes and plays it", async ({
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
  const contexts: { program: { scripts: { procedures?: { id: string; name: string }[] }[] } }[] =
    [];
  await page.route("**/api/tutor/studio/ori", async (route) => {
    const context = route.request().postDataJSON();
    contexts.push(context);
    const first = context.program.scripts[0].procedures?.[0]?.id;
    const decision = evaluateOriStudioOutput(context, {
      version: ORI_STUDIO_VERSION,
      kind: "program-suggestion",
      actorId: context.actorId,
      block: first ? { type: "callProcedure", procedureId: first } : { type: "move", steps: 40 },
    });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ message: decision.message, proposal: decision.proposal }),
    });
  });
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();

  // Two blocks of the child's own.
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
  await page.getByRole("textbox", { name: "Título del bloque" }).fill("Cuadrado");
  await page.getByRole("button", { name: "Crear bloque con estos bloques" }).click();
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Girar a la izquierda" }).click();
  await page.getByRole("textbox", { name: "Título del bloque" }).fill("Vuelta");
  await page.getByRole("button", { name: "Crear bloque con estos bloques" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(2);
  const before = await page.locator(".kids-program-block").allInnerTexts();

  // Ori proposes to use one of them: nothing changes until the child decides.
  await page.getByRole("button", { name: "Pedirle una idea a Ori" }).click();
  await expect(page.locator(".kids-ori-proposal")).toContainText("+ Usar: Cuadrado");
  expect(await page.locator(".kids-program-block").allInnerTexts()).toEqual(before);
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);

  // The child changes it to their other block, then uses it.
  await page.getByRole("button", { name: "Cambiar idea" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(3);
  await expect(page.locator(".kids-program-block").last()).toContainText("Usar: Vuelta");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText(/bloques ejecutados/)).toBeVisible();

  // What Ori suggested is only the id of a block the character already has.
  expect(contexts).toHaveLength(1);
});

test("Ori's block idea can be refused and a lone block cannot be swapped", async ({ page }) => {
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
  await page.route("**/api/tutor/studio/ori", async (route) => {
    const context = route.request().postDataJSON();
    const id = context.program.scripts[0].procedures?.[0]?.id;
    const decision = evaluateOriStudioOutput(context, {
      version: ORI_STUDIO_VERSION,
      kind: "program-suggestion",
      actorId: context.actorId,
      block: { type: "callProcedure", procedureId: id },
    });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ message: decision.message, proposal: decision.proposal }),
    });
  });
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
  await page.getByRole("textbox", { name: "Título del bloque" }).fill("Paso");
  await page.getByRole("button", { name: "Crear bloque con estos bloques" }).click();
  await page.getByRole("button", { name: "Pedirle una idea a Ori" }).click();
  await expect(page.locator(".kids-ori-proposal")).toContainText("+ Usar: Paso");
  await expect(page.getByRole("button", { name: "Cambiar idea" })).toHaveCount(0);
  await page.getByRole("button", { name: "No usar" }).click();
  await expect(page.locator(".kids-ori-proposal")).toHaveCount(0);
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
});

test("free scene composes a tune with the music extension and keeps it, with the pen, after reopening", async ({
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
  const music = page.getByRole("group", { name: "Música" });
  await music.getByLabel("Velocidad").selectOption("90");
  await music.getByRole("button", { name: "+ Velocidad" }).click();
  await music.getByLabel("Instrumento").selectOption("flute");
  await music.getByRole("button", { name: "+ Instrumento" }).click();
  await music.getByLabel("Nota").selectOption("64");
  await music.getByRole("button", { name: "+ Tocar nota" }).click();
  await music.getByLabel("Tocar percusión").selectOption("snare");
  await music.getByRole("button", { name: "+ Tocar percusión" }).click();
  await music.getByLabel("Lado del sonido").selectOption("-100");
  await music.getByRole("button", { name: "+ Lado del sonido" }).click();
  await page.getByRole("button", { name: "+ Bajar el lápiz" }).click();
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await expect(page.locator(".kids-program-block").nth(2)).toContainText("Tocar nota: Mi 4");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("6 bloques ejecutados")).toBeVisible();
  await reloadTo(page, "#/proyectos");
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(page.locator(".kids-program-block").nth(1)).toContainText("Instrumento: flauta");
  await expect(page.locator(".kids-program-block").nth(3)).toContainText(
    "Tocar percusión: redoblante",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("Ori's tune is heard first, only joins the program when used, and can be undone", async ({
  page,
}) => {
  await openStudio(page, "6-8");
  await page.evaluate(() =>
    localStorage.setItem(
      "agorix.kids.flags.v1",
      JSON.stringify(["ageBands", "customImages", "extensionMusic"]),
    ),
  );
  await page.reload();
  await expect(page.getByRole("button", { name: "Tocar una melodía" })).toBeVisible();
  await page.getByRole("button", { name: "Tocar una melodía" }).click();
  const card = page.getByTestId("intent-card");
  await expect(card).toContainText("Ori propone 6 bloques");
  await expect(page.getByTestId("ori-ghost-block")).toHaveCount(6);
  await expect(page.locator(".kids-program-block")).toHaveCount(0);
  await card.getByRole("button", { name: "Escuchar la idea" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(0);
  await card.getByRole("button", { name: "Usar idea" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(6);
  await expect(page.locator(".kids-program-block").nth(1)).toContainText("Tocar nota: Do 4");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("6 bloques ejecutados")).toBeVisible();
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(0);
});

test("free scene shows Looks and Motion as snap-together blocks and keeps tap, Enter and drag", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 3200 });
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

  const palette = page.locator(".kids-studio-palette");
  await expect(page.locator(".kids-root")).toHaveAttribute("data-block-palette", "scratch");
  // The visible action no longer shows a plus; the plus stays in the accessible name so the
  // existing voice and test paths keep working.
  const say = palette.getByRole("button", { name: "+ Decir", exact: true });
  const visibleSay = await say.evaluate((element) => {
    const clone = element.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".kids-visually-hidden").forEach((node) => node.remove());
    return clone.textContent?.trim();
  });
  expect(visibleSay).toBe("Decir");
  const sayBlock = palette
    .locator(".kids-palette-tool")
    .filter({ has: page.getByRole("button", { name: "+ Decir", exact: true }) });
  await expect(sayBlock.getByRole("textbox", { name: "Decir / Pensar" })).toHaveValue("¡Hola!");

  const sizeBlock = palette
    .locator(".kids-palette-tool")
    .filter({ has: page.getByRole("button", { name: "+ Tamaño", exact: true }) });
  const size = sizeBlock.getByRole("combobox", { name: "Tamaño" });
  await expect(size).toHaveValue("100");
  const moveBlock = palette
    .locator(".kids-palette-tool")
    .filter({ has: page.getByRole("button", { name: "+ Mover", exact: true }) });
  await expect(moveBlock.getByRole("combobox", { name: "Mover" })).toHaveValue("1");

  // Drag into the empty program first, like the existing drag suite: the ghost uses the visible label.
  const turn = palette.getByRole("button", { name: "+ Girar a la derecha", exact: true });
  const drop = page.locator(".kids-program-drop");
  const from = (await turn.boundingBox())!;
  const to = (await drop.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 20, { steps: 3 });
  await expect(page.locator(".kids-drag-ghost")).toHaveText("Girar a la derecha");
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
  await expect(page.locator(".kids-program-block").last()).toContainText("Girar a la derecha 90°");

  // The closed value list still decides what the block adds.
  await size.selectOption("50");
  await palette.getByRole("button", { name: "+ Tamaño", exact: true }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(2);
  await expect(page.locator(".kids-program-block").last()).toContainText("Tamaño: 50%");

  // Keyboard: focus and Enter are the same path as a tap.
  const wait = palette.getByRole("button", { name: "+ Esperar", exact: true });
  await wait.focus();
  await wait.press("Enter");
  await expect(page.locator(".kids-program-block")).toHaveCount(3);
  await expect(page.locator(".kids-program-block").last()).toContainText("Esperar: 1s");

  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
});

test("free scene shows Media and Logic as snap-together blocks and keeps tools out of drag", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 3800 });
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

  const palette = page.locator(".kids-studio-palette");
  await expect(page.locator(".kids-root")).toHaveAttribute("data-block-palette", "scratch");

  const costumeAdd = palette.getByRole("button", { name: "+ Cambiar disfraz", exact: true });
  const costumeBlock = palette.locator(".kids-palette-tool-looks").filter({
    has: page.getByRole("button", { name: "+ Cambiar disfraz", exact: true }),
  });
  const costume = costumeBlock.getByRole("combobox", { name: "Cambiar disfraz" });
  await expect(costume).toHaveValue("mika");
  await costume.selectOption("nova");
  await costumeAdd.click();
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
  await expect(page.locator(".kids-program-block").last()).toContainText("Cambiar disfraz: Nova");

  // Drag still starts on the add button and carries the closed value with it.
  const backdropAdd = palette.getByRole("button", { name: "+ Cambiar fondo", exact: true });
  const backdropBlock = palette.locator(".kids-palette-tool-looks").filter({
    has: page.getByRole("button", { name: "+ Cambiar fondo", exact: true }),
  });
  await backdropBlock.getByRole("combobox", { name: "Cambiar fondo" }).selectOption("forest");
  const drop = page.locator(".kids-program-drop");
  const from = (await backdropAdd.boundingBox())!;
  const to = (await drop.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 20, { steps: 3 });
  await expect(page.locator(".kids-drag-ghost")).toHaveText("Cambiar fondo");
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator(".kids-program-block")).toHaveCount(2);
  await expect(page.locator(".kids-program-block").last()).toContainText("Cambiar fondo: Bosque");

  const soundAdd = palette.getByRole("button", { name: "+ Sonar", exact: true });
  const soundBlock = palette.locator(".kids-palette-tool-sound").filter({
    has: page.getByRole("button", { name: "+ Sonar", exact: true }),
  });
  const preview = soundBlock.getByRole("button", { name: "▶ Sonar", exact: true });
  await expect(preview).not.toHaveAttribute("data-kids-add", "true");
  await soundBlock.getByRole("combobox", { name: "Sonar" }).selectOption("kids:bell");
  await soundAdd.click();
  await expect(page.locator(".kids-program-block")).toHaveCount(3);
  await expect(page.locator(".kids-program-block").last()).toContainText("Sonar: Campana");

  // Keyboard: focus and Enter are the same path as a tap.
  const stop = palette.getByRole("button", { name: "+ Detener sonidos", exact: true });
  await stop.focus();
  await stop.press("Enter");
  await expect(page.locator(".kids-program-block")).toHaveCount(4);
  await expect(page.locator(".kids-program-block").last()).toContainText("Detener sonidos");

  // Closed number slots stay inside their block and feed the action.
  await palette.getByRole("spinbutton", { name: "Volumen", exact: true }).fill("40");
  await palette.getByRole("button", { name: "+ Fijar volumen", exact: true }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(5);
  await expect(page.locator(".kids-program-block").last()).toContainText("Fijar volumen: 40%");
  await palette.getByRole("spinbutton", { name: "Cambio de volumen", exact: true }).fill("-15");
  await palette.getByRole("button", { name: "+ Cambiar volumen", exact: true }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(6);
  await expect(page.locator(".kids-program-block").last()).toContainText("Cambiar volumen: -15");

  // Repeat and group share the same closed values inside one control block.
  const repeatAdd = palette.getByRole("button", {
    name: "+ Repetir → mover 1",
    exact: true,
  });
  const logicBlock = palette.locator(".kids-palette-tool-control").filter({
    has: page.getByRole("button", { name: "+ Repetir → mover 1", exact: true }),
  });
  const repeatCount = logicBlock.getByRole("combobox", { name: "Repetir", exact: true });
  await expect(repeatCount).toHaveValue("3");
  await expect(
    logicBlock.getByRole("combobox", { name: "Bloques del final", exact: true }),
  ).toHaveValue("2");
  await repeatCount.selectOption("5");
  await logicBlock.getByRole("button", { name: "Repetir estos bloques", exact: true }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(5);
  await expect(page.locator(".kids-program-block").last()).toContainText("Repetir 5");
  await repeatAdd.click();
  await expect(page.locator(".kids-program-block")).toHaveCount(6);
  await expect(page.locator(".kids-program-block").last()).toContainText("Repetir 5");
  await expect(
    page.locator(".kids-program-block").last().locator(".kids-nested-block").first(),
  ).toContainText("Mover 1");

  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
});

// Issue #1110: a category bar over the palette jumps to each block family without hiding any.
test("the block category bar jumps to each family and wraps on a phone", async ({ page }) => {
  await openStudio(page, "9-12");
  const bar = page.getByRole("navigation", { name: "Categorías de bloques" });
  await expect(bar.getByRole("button")).toHaveText([
    "Movimiento",
    "Apariencia y tiempo",
    "Disfraces, fondos y sonidos",
    "Eventos y control",
    "Variables y listas",
    "Mis bloques",
  ]);
  // Lápiz and Música are packs a grown-up turned off here, so the bar leaves them out too.
  const before = await page.locator(".kids-studio-palette button").count();
  await bar.getByRole("button", { name: "Variables y listas" }).click();
  const heading = page.getByRole("heading", { name: "Variables y listas" });
  await expect(heading).toBeFocused();
  await expect(heading).toBeInViewport();
  await bar.getByRole("button", { name: "Mis bloques" }).click();
  await expect(page.getByRole("heading", { name: "Mis bloques" })).toBeFocused();
  // Jumping hides nothing: every block is still in the palette.
  expect(await page.locator(".kids-studio-palette button").count()).toBe(before);
  const layout = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const small = [...document.querySelectorAll<HTMLElement>(".kids-studio-category")].filter(
      (button) => {
        const rect = button.getBoundingClientRect();
        return rect.right > width + 1 || rect.left < -1 || rect.height < 44;
      },
    ).length;
    return { sideways: document.documentElement.scrollWidth > width, small };
  });
  expect(layout).toEqual({ sideways: false, small: 0 });
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
});
