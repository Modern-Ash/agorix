import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Issue #447: Scratch-style block hues behind the puzzleShape flag; default look unchanged.
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
  await page.reload();
  await page.getByRole("button", { name: "Misión 1" }).click();
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  await page.getByRole("button", { name: "+ girar ←", exact: true }).click();
  await page.getByRole("button", { name: "+ repetir", exact: true }).click();
  await page.locator(".kids-palette").getByRole("button", { name: "+ sonar", exact: true }).click();
}

const colours = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((node) => {
      const style = getComputedStyle(node);
      return { bg: style.backgroundColor, color: style.color };
    });

test("the default palette is unchanged", async ({ page }) => {
  await openEditor(page, []);
  await expect(page.locator(".kids-root")).toHaveAttribute("data-block-palette", "default");
  expect(await colours(page, ".kids-program-block.kids-block-move")).toEqual({
    bg: "rgb(40, 100, 197)",
    color: "rgb(255, 255, 255)",
  });
  expect(await colours(page, ".kids-program-block.kids-block-sound")).toEqual({
    bg: "rgb(173, 92, 18)",
    color: "rgb(255, 255, 255)",
  });
});

test("the Scratch palette applies to program and palette blocks and passes axe contrast", async ({
  page,
}) => {
  await openEditor(page, ["puzzleShape"]);
  await expect(page.locator(".kids-root")).toHaveAttribute("data-block-palette", "scratch");
  for (const selector of [
    ".kids-program-block.kids-block-move",
    ".kids-palette-block.kids-block-move",
  ]) {
    expect((await colours(page, selector)).bg).toBe("rgb(76, 151, 255)");
  }
  expect((await colours(page, ".kids-program-block.kids-block-repeat")).bg).toBe(
    "rgb(255, 171, 25)",
  );
  expect((await colours(page, ".kids-program-block.kids-block-sound")).bg).toBe(
    "rgb(207, 99, 207)",
  );
  const violations = (await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze())
    .violations;
  expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
});
