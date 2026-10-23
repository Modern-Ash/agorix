import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Issue #446: duplicate block, behind the `duplicate` flag.
test.use({ hasTouch: true, serviceWorkers: "block" });

async function openEditor(page: Page, flags: string[]) {
  await page.goto("/kids");
  await page.evaluate((list) => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
    localStorage.setItem("agorix.kids.flags.v1", JSON.stringify(list));
  }, flags);
  await page.reload();
  await page.getByRole("button", { name: "Misión 1" }).click();
}

test("the duplicate button is absent while the flag is off", async ({ page }) => {
  await openEditor(page, []);
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  await expect(page.getByRole("button", { name: /Duplicar/ })).toHaveCount(0);
});

test("duplicates a block, runs the copy, and undo removes it in one step", async ({ page }) => {
  await openEditor(page, ["duplicate"]);
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  await page.getByRole("combobox", { name: "mover 1" }).selectOption("2");
  await page.getByRole("button", { name: /Duplicar mover 1/ }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(2);
  await expect(page.getByRole("combobox", { name: "mover 2" })).toHaveValue("2");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sí", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Llegaste");
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
});

test("with the flag on, a repeat with children fits a phone and has no serious a11y issues", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await openEditor(page, ["duplicate"]);
  await page.getByRole("button", { name: "+ repetir", exact: true }).click();
  await page.locator(".kids-repeat-add").getByRole("button", { name: "+ mover" }).click();
  await page.getByRole("button", { name: /Duplicar mover/ }).click();
  await expect(page.locator(".kids-repeat-body .kids-program-block")).toHaveCount(2);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(violations.map((v) => v.id)).toEqual([]);
});
