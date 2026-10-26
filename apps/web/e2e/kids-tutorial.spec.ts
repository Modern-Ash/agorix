import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { reloadToMap } from "./helpers.js";

// Issue #470: first-run coach in mission 1, behind the tutorial flag.
test.use({ hasTouch: true, serviceWorkers: "block" });

async function open(page: Page, flags: string[], progress: Record<string, unknown> = {}) {
  await page.goto("/kids");
  await page.evaluate(
    ({ list, extra }) => {
      localStorage.clear();
      localStorage.setItem("agorix.locale", "es");
      localStorage.setItem("agorix.kids.flags.v1", JSON.stringify(list));
      localStorage.setItem(
        "agorix.kids.progress.v1",
        JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {}, ...extra }),
      );
    },
    { list: flags, extra: progress },
  );
  await reloadToMap(page);
  await page.getByRole("button", { name: "Misión 1" }).click();
}

const coach = (page: Page) => page.locator(".kids-tutorial");
const savedDone = (page: Page) =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem("agorix.kids.progress.v1") ?? "{}").tutorialDone,
  );

test("nothing changes while the flag is off", async ({ page }) => {
  await open(page, []);
  await expect(coach(page)).toHaveCount(0);
});

test("walks add, number, run, then stays gone after a reload", async ({ page }) => {
  await open(page, ["tutorial"]);
  await expect(coach(page)).toContainText("Tocá “+ mover”");
  await expect(page.locator('[data-tutorial="target"]')).toHaveText("+ mover");
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(violations.map((v) => v.id)).toEqual([]);

  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  await expect(coach(page)).toContainText("Cambiá el número");
  await page.getByRole("combobox", { name: "mover 1" }).selectOption("4");
  await expect(coach(page)).toContainText("tocá “Jugar”");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(coach(page)).toContainText("Elegí lo que creés");
  await page.getByRole("dialog").getByRole("button", { name: "Sí", exact: true }).click();
  await expect(coach(page)).toHaveCount(0);
  await expect.poll(() => savedDone(page)).toBe(true);

  await reloadToMap(page);
  await page.getByRole("button", { name: "Misión 1" }).click();
  await expect(coach(page)).toHaveCount(0);
});

test("skipping hides it for good and play is never blocked", async ({ page }) => {
  await open(page, ["tutorial"]);
  await page.getByRole("button", { name: "Saltar" }).click();
  await expect(coach(page)).toHaveCount(0);
  await expect.poll(() => savedDone(page)).toBe(true);
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  await page.getByRole("combobox", { name: "mover 1" }).selectOption("4");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sí", exact: true }).click();
  await expect(page.locator(".kids-run-status")).toContainText("Llegaste");
});

test("pressing Jugar early jumps to the prediction step and the app still works", async ({
  page,
}) => {
  await open(page, ["tutorial"]);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(coach(page)).toContainText("Elegí lo que creés");
  await page.getByRole("dialog").getByRole("button", { name: "No sé", exact: true }).click();
  await expect(coach(page)).toHaveCount(0);
});

test("is not shown again for a child who already finished it", async ({ page }) => {
  await open(page, ["tutorial"], { tutorialDone: true });
  await expect(coach(page)).toHaveCount(0);
});
