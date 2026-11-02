import AxeBuilder from "@axe-core/playwright";
import { resolve } from "node:path";
import { expect, test } from "./fixtures.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

// Issue #1134: Crear shows the actual scene character and backdrop, remembers both, and starts
// the one creative editor with that selection.
test("the scene character and backdrop stay chosen and start the same scene", async ({ page }) => {
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
  const choice = page.getByRole("group", { name: "Tu elección" });
  await expect(choice).toContainText("Nova");
  await expect(page.getByRole("button", { name: /Elegí tu personaje: 🐼|: 🐼$/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Nova", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // On a phone Crear is two tabs, character and backdrop; the scene opens from the bar at any time.
  const step = (n: number) =>
    page.getByRole("navigation", { name: "Pasos para crear" }).getByRole("button", {
      name: new RegExp(`^${n} ·`),
    });
  await page.getByRole("button", { name: "Cometa", exact: true }).click();
  await step(2).click();
  const backdrop = page.getByLabel("Fondos incluidos").getByRole("button", { name: "Arrecife" });
  await backdrop.click();
  await expect(choice).toContainText("Cometa");
  await expect(choice).toContainText("Arrecife");
  await step(1).click();
  await expect(page.getByRole("button", { name: "Cometa", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Nova", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);

  // Leaving and coming back, even after a reload, keeps both scene selections.
  await page.getByRole("button", { name: "Mapa" }).click();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await step(2).click();
  await expect(backdrop).toHaveAttribute("aria-pressed", "true");
  await step(1).click();
  await expect(page.getByRole("button", { name: "Cometa", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.reload();
  await step(2).click();
  await expect(backdrop).toHaveAttribute("aria-pressed", "true");
  await step(1).click();
  await expect(page.getByRole("button", { name: "Cometa", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: "Crear escena" }).click();
  await expect(
    page.getByRole("group", { name: "Personajes" }).getByRole("button").first(),
  ).toContainText("Cometa");
});

test("on a phone Crear is two tabs with the choice and one action always in view, no sideways scroll and touch targets", async ({
  page,
}) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
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
    const steps = page.getByRole("navigation", { name: "Pasos para crear" });
    await expect(steps.getByRole("button", { name: /^1 ·/ })).toHaveAttribute(
      "aria-current",
      "step",
    );
    await expect(page.getByLabel("Personajes incluidos")).toBeVisible();
    await expect(page.getByLabel("Fondos incluidos")).toBeHidden();
    await expect(page.getByRole("group", { name: "Tu elección" })).toContainText("Nova");
    await expect(page.getByRole("button", { name: "Crear escena" })).toBeVisible();
    await steps.getByRole("button", { name: /^2 ·/ }).click();
    await expect(steps.getByRole("button", { name: /^2 ·/ })).toHaveAttribute(
      "aria-current",
      "step",
    );
    await expect(page.getByLabel("Fondos incluidos")).toBeVisible();
    await expect(page.getByLabel("Personajes incluidos")).toBeHidden();
    await expect(page.getByRole("button", { name: "Crear escena" })).toBeVisible();
    for (const button of await steps.getByRole("button").all())
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  }
});

test("Crear offers drawing your own character or backdrop and opens the canvas in the scene", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
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
  await page.getByRole("button", { name: "Dibujar mi propio personaje" }).click();
  await expect(page.getByRole("heading", { name: "Escena libre", exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Lienzo para dibujar" })).toBeVisible();
  await page.getByRole("button", { name: "Volver a Crear" }).click();
  await page.getByRole("button", { name: "Dibujar mi propio fondo" }).click();
  await expect(page.getByRole("img", { name: "Lienzo para dibujar" })).toBeVisible();
  // A normal start never opens the canvas on its own.
  await page.getByRole("button", { name: "Volver a Crear" }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  await expect(page.getByRole("img", { name: "Lienzo para dibujar" })).toHaveCount(0);
});

test("Crear restores uploading a character and a backdrop into the new scene", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
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
  const image = resolve("e2e/fixtures/kids-solid.png");
  await page.getByLabel("Subir mi propio personaje").setInputFiles(image);
  await expect(page.getByRole("heading", { name: "Escena libre", exact: true })).toBeVisible();
  await expect(page.locator(".kids-studio-stage-actor .kids-art-image")).toHaveCSS(
    "background-image",
    /data:image\//,
  );
  await page.getByRole("button", { name: "Volver a Crear" }).click();
  await page.getByLabel("Subir mi propio fondo").setInputFiles(image);
  await expect(page.getByRole("heading", { name: "Escena libre", exact: true })).toBeVisible();
  await expect(page.locator(".kids-studio-stage")).toHaveCSS("background-image", /data:image\//);
});
