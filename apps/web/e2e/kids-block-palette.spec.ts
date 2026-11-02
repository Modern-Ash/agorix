import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures.js";

// Issue #447: Scratch-style block hues behind the puzzleShape flag; default look unchanged.
import { BLOCKS_UNLOCKED, addStudioBlock } from "./helpers.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

async function openEditor(page: Page, flags: string[]) {
  await page.goto("/kids");
  await page.evaluate((list) => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem("agorix.kids.flags.v1", JSON.stringify(list));
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  }, flags);
  await page.evaluate(
    (state) => localStorage.setItem("agorix.kids.mastery.v1", state),
    BLOCKS_UNLOCKED,
  );
  await page.reload();
  await page.getByRole("button", { name: "Misión 1" }).click();
  await addStudioBlock(page, "Movimiento", "+ Mover");
  await page
    .getByRole("navigation", { name: "Categorías de bloques" })
    .getByRole("button", { name: "Sonido" })
    .click();
  await page
    .getByRole("button", { name: /^\+ (Tocar sonido|Sonar)/ })
    .first()
    .click();
}

test("the default palette is unchanged", async ({ page }) => {
  await openEditor(page, []);
  await expect(page.locator(".kids-root")).toHaveAttribute("data-block-palette", "default");
});

test("the Scratch palette switch applies to the studio and passes axe contrast", async ({
  page,
}) => {
  await openEditor(page, ["puzzleShape"]);
  await expect(page.locator(".kids-root")).toHaveAttribute("data-block-palette", "scratch");
  const violations = (await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze())
    .violations;
  expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
});
