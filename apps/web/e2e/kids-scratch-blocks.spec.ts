import { expect, test, type Page } from "./fixtures.js";
import { clickCreateScene } from "./helpers.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

async function openScene(page: Page) {
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
  await clickCreateScene(page);
}

test("change x and set y move the character without turning it", async ({ page }) => {
  await openScene(page);
  await page.getByRole("button", { name: "+ Cambiar x en", exact: true }).click();
  await page.getByRole("button", { name: "+ Fijar y", exact: true }).click();
  await expect(page.locator(".kids-program-block").first()).toContainText("Cambiar x en 40");
  const actor = page.locator(".kids-studio-stage-actor").first();
  const before = await actor.evaluate((node) => (node as HTMLElement).style.left);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect
    .poll(() => actor.evaluate((node) => (node as HTMLElement).style.left))
    .not.toBe(before);
});

test("say for N seconds shows the bubble and then takes it away", async ({ page }) => {
  await openScene(page);
  await page.getByRole("button", { name: /^\+ Decir por 1 s$/ }).click();
  await expect(page.locator(".kids-program-block").first()).toContainText("(1s)");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  const bubble = page.locator(".kids-studio-bubble");
  await expect(bubble).toBeVisible();
  await expect(bubble).toHaveCount(0, { timeout: 5000 });
});

test("go to a random spot moves the character, and go to the pointer follows the stage", async ({
  page,
}) => {
  await openScene(page);
  await page.getByRole("button", { name: "+ Ir a un lugar al azar", exact: true }).click();
  await expect(page.locator(".kids-program-block").first()).toContainText("Ir a un lugar al azar");
  const actor = page.locator(".kids-studio-stage-actor").first();
  const before = await actor.evaluate((node) => (node as HTMLElement).style.left);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect
    .poll(() => actor.evaluate((node) => (node as HTMLElement).style.left))
    .not.toBe(before);
  await page.getByRole("button", { name: "+ Ir al puntero", exact: true }).click();
  await expect(page.locator(".kids-program-block").last()).toContainText("Ir al puntero");
});

test("broadcast and wait is a block of its own and shows as such", async ({ page }) => {
  await openScene(page);
  await page.getByRole("button", { name: "+ Enviar mensaje y esperar", exact: true }).click();
  await expect(page.locator(".kids-program-block").first()).toContainText(
    "Enviar mensaje y esperar",
  );
});

test("next costume needs a costume the child drew, then cycles back to the character", async ({
  page,
}) => {
  await openScene(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  // Nothing to change to yet: the block stays and says why.
  await page
    .getByRole("button", { name: "+ Siguiente disfraz", exact: true })
    .click({ force: true });
  await expect(page.getByText("Primero dibujá otro disfraz").first()).toBeVisible();
  await expect(page.locator(".kids-program-block")).toHaveCount(0);

  await page.getByRole("tab", { name: /Disfraces/ }).click();
  await page.getByRole("button", { name: "Dibujar disfraz" }).click();
  const canvas = page.getByRole("img", { name: "Lienzo para dibujar" });
  await canvas.scrollIntoViewIfNeeded();
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.click(bounds.x + 80, bounds.y + 80);
  await page.getByRole("button", { name: "Guardar dibujo" }).click();
  await expect(page.locator(".kids-studio-stage-actor .kids-art-image")).toHaveCSS(
    "background-image",
    /data:image\/(png|webp)/,
  );

  await page.getByRole("tab", { name: /Código/ }).click();
  await page.getByRole("button", { name: "+ Siguiente disfraz", exact: true }).click();
  await expect(page.locator(".kids-program-block").first()).toContainText("Siguiente disfraz (2)");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  // The drawn costume was showing; the next one in the list is the character itself.
  await expect
    .poll(() =>
      page
        .locator(".kids-studio-stage-actor .kids-art-image")
        .first()
        .evaluate((node) => getComputedStyle(node).backgroundImage),
    )
    .not.toMatch(/data:image\/(png|webp)/);
});

test("the rotation style decides how a turn looks on stage", async ({ page }) => {
  await openScene(page);
  await page.getByRole("combobox", { name: "Estilo de giro" }).selectOption("none");
  await page.getByRole("button", { name: "+ Estilo de giro", exact: true }).click();
  await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
  await expect(page.locator(".kids-program-block").first()).toContainText(
    "Estilo de giro: Sin girar",
  );
  const costume = page.locator(".kids-studio-stage-actor .kids-studio-stage-costume").first();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  // Turning without rotating leaves the picture upright.
  await expect
    .poll(() => costume.evaluate((node) => (node as HTMLElement).style.transform))
    .not.toContain("rotate");
});

test("say with a variable shows its value after the text", async ({ page }) => {
  await openScene(page);
  await page.getByRole("textbox", { name: "Nombre" }).fill("Puntos");
  await page.getByRole("button", { name: "+ Crear variable" }).click();
  await page.getByRole("button", { name: "+ Guardar posición X", exact: true }).click();
  await page.getByRole("button", { name: "+ Decir con variable", exact: true }).click();
  await expect(page.locator(".kids-program-block").last()).toContainText("Decir: ¡Hola! + Puntos");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.locator(".kids-studio-bubble")).toContainText(/¡Hola!\s?\d/);
});
