import { expect, test, type Page } from "./fixtures.js";
import { clickCreateScene } from "./helpers.js";

// Issue #1240: the Properties card also edits a block already in the program. The values are the
// same closed lists the palette offers, and every change is one undoable step.
test.use({ serviceWorkers: "block" });

async function sceneWith(page: Page, viewport = { width: 1280, height: 800 }) {
  await page.setViewportSize(viewport);
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
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
}

const blocks = (page: Page) => page.locator(".kids-program-block");
const card = (page: Page) => page.getByLabel("Propiedades", { exact: true });

test("a double click on a block edits its value, and undo takes it back (#1240)", async ({
  page,
}) => {
  await sceneWith(page);
  await expect(blocks(page).first()).toContainText("Mover 1");
  await blocks(page)
    .first()
    .dblclick({ position: { x: 90, y: 14 } });
  await expect(card(page)).toBeVisible();
  await expect(card(page).locator(".kids-inspector-title strong")).toContainText("Bloque · Mover");
  await card(page).getByLabel("Casillas").selectOption("100");
  await expect(blocks(page).first()).toContainText("Mover 2.5");
  // The program changed: Play runs the new value, and the whole thing is one undo.
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("2 bloques ejecutados")).toBeVisible();
  await card(page)
    .getByRole("button", { name: /^Cerrar/ })
    .click();
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(blocks(page).first()).toContainText("Mover 1");
});

test("turn, sound, costume and speech blocks edit from the card (#1240)", async ({ page }) => {
  await sceneWith(page);
  await blocks(page)
    .nth(1)
    .dblclick({ position: { x: 90, y: 14 } });
  await card(page).getByLabel("Grados").selectOption("-90");
  await expect(blocks(page).nth(1)).toContainText("izquierda");
  await card(page)
    .getByRole("button", { name: /^Cerrar/ })
    .click();

  await page.getByRole("button", { name: "+ Sonar", exact: true }).click();
  await blocks(page)
    .nth(2)
    .dblclick({ position: { x: 90, y: 14 } });
  await card(page).getByLabel("Sonido").selectOption({ label: "Campana" });
  await expect(blocks(page).nth(2)).toContainText("Campana");
  await card(page)
    .getByRole("button", { name: /^Cerrar/ })
    .click();

  await page.getByRole("button", { name: "+ Decir" }).click();
  await blocks(page)
    .nth(3)
    .dblclick({ position: { x: 90, y: 14 } });
  const text = card(page).getByLabel("Texto");
  await text.fill("Chau");
  await text.press("Enter");
  await expect(blocks(page).nth(3)).toContainText("Chau");
});

test("Enter on a focused block and the block menu open it too (#1240)", async ({ page }) => {
  await sceneWith(page);
  await blocks(page).first().focus();
  await page.keyboard.press("Enter");
  await expect(card(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(card(page)).toHaveCount(0);
  await blocks(page)
    .first()
    .click({ button: "right", position: { x: 90, y: 14 } });
  await page.getByRole("menuitem", { name: "Propiedades" }).click();
  await expect(card(page).getByLabel("Casillas")).toBeVisible();
});

test("a block with nothing to edit does not open an empty card, and removing the block closes it (#1240)", async ({
  page,
}) => {
  await sceneWith(page);
  await page.getByRole("button", { name: "+ Esconder" }).click();
  await blocks(page)
    .nth(2)
    .dblclick({ position: { x: 90, y: 14 } });
  await expect(card(page)).toHaveCount(0);
  await blocks(page)
    .first()
    .dblclick({ position: { x: 90, y: 14 } });
  await expect(card(page)).toBeVisible();
  await page.getByRole("button", { name: "Quitar bloque 1" }).click();
  await expect(card(page)).toHaveCount(0);
});
