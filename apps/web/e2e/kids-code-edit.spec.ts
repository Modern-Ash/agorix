import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures.js";
import { clickCreateScene } from "./helpers.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

// #1615: the Agorix Code text can be edited and read back into the program, as one undoable step.
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

test("the text is edited, says what it does not understand, and applies as one undoable step", async ({
  page,
}) => {
  await openScene(page);
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "Código", exact: true }).click();
  await page.getByRole("button", { name: "Editar el texto" }).click();
  const box = page.getByRole("textbox", { name: "Texto del programa" });
  const original = await box.inputValue();
  expect(original).toContain("move 40");

  // A line it does not understand is named, with its line, and Apply stays off.
  await box.fill(original.replace("move 40", "jump 3"));
  await expect(page.getByTestId("code-edit-status")).toContainText("No entiendo esta línea");
  await expect(page.getByRole("button", { name: "Aplicar" })).toBeDisabled();

  // A valid edit is applied to the blocks.
  await box.fill(original.replace("move 40", "move 80"));
  await expect(page.getByTestId("code-edit-status")).toContainText("Se entiende");
  const axe = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(axe.map((entry) => entry.id)).toEqual([]);
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.locator(".kids-code-strip")).toContainText("move 80");
  await page.getByRole("button", { name: "Bloques", exact: true }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(2);

  // One undo takes the whole edit back.
  await page.getByRole("button", { name: "Deshacer" }).click();
  await page.getByRole("button", { name: "Código", exact: true }).click();
  await expect(page.locator(".kids-code-strip")).not.toContainText("move 80");
});

test("a program with a block the text cannot read stays editable with blocks only", async ({
  page,
}) => {
  await openScene(page);
  await page.getByRole("button", { name: "+ Crear copias" }).click();
  await page.getByRole("button", { name: "Código", exact: true }).click();
  await expect(page.getByRole("button", { name: "Editar el texto" })).toHaveCount(0);
  await expect(page.locator(".kids-code-edit")).toContainText("editalo con bloques");
});

test("the text can use pen, music, motion and looks blocks, and the packs follow", async ({
  page,
}) => {
  await openScene(page);
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "Código", exact: true }).click();
  await page.getByRole("button", { name: "Editar el texto" }).click();
  const box = page.getByRole("textbox", { name: "Texto del programa" });
  await box.fill(
    "when start\n  pen down\n  set pen color red\n  move 40\n  play note 60 for 1 beats\n  set size to 150\n  bounce on edge\n",
  );
  await expect(page.getByTestId("code-edit-status")).toContainText("Se entiende");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.locator(".kids-code-strip")).toContainText("pen down");
  await expect(page.locator(".kids-code-strip")).toContainText("play note 60 for 1 beats");
  await page.getByRole("button", { name: "Bloques", exact: true }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(6);
});
