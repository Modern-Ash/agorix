import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures.js";
import { reloadToMap, addStudioBlock } from "./helpers.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

async function openMission(page: Page, locale: "es" | "en" = "es") {
  await page.goto("/kids");
  await page.evaluate((lang) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("agorix.locale", lang);
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  }, locale);
  await reloadToMap(page);
  await page.getByRole("button", { name: locale === "es" ? "Misión 1" : "Mission 1" }).click();
}

const evidence = (page: Page) =>
  page.evaluate(() => JSON.parse(sessionStorage.getItem("agorix.kids.reflections.v1") ?? "[]"));

test("builds, runs and undoes on the real Kids mission, and keeps the work", async ({ page }) => {
  await openMission(page);
  await addStudioBlock(page, "Movimiento", "+ Mover", 4);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByTestId("scene-goal-result")).toContainText("Lograste la meta");
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(3);
  await page.getByRole("button", { name: "Rehacer" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(4);
  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await expect(page.locator(".kids-stars")).toHaveText("★1");
  await page.getByRole("button", { name: "Misión 1" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(4);
});

test("records the guess and the revision after a run, from the child's actions only", async ({
  page,
}) => {
  await openMission(page);
  await addStudioBlock(page, "Movimiento", "+ Mover", 2);
  expect(await evidence(page)).toEqual([]);
  await page.getByLabel("a la derecha", { exact: true }).check();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await addStudioBlock(page, "Movimiento", "+ Mover");
  const events = await evidence(page);
  expect(events.map((event: { kind: string }) => event.kind)).toEqual([
    "predictionMade",
    "reflectionRecorded",
    "programRevisedAfterExecution",
  ]);
  expect(events[0]).toMatchObject({ matchedRuntimeOutcome: true });
  expect(events[2]).toMatchObject({ changedNodeCount: 1, afterUnsuccessfulRun: true });
  expect(JSON.stringify(events)).not.toMatch(/timestamp|freeText|transcript/);
});

test("reveals hints in order and records only the levels opened", async ({ page }) => {
  await openMission(page);
  for (let level = 1; level <= 3; level++)
    await page.getByRole("button", { name: `Pista ${level}`, exact: true }).click();
  const events = await evidence(page);
  expect(events.map((event: { level: number }) => event.level)).toEqual([1, 2, 3]);
  expect(events.at(-1)).toMatchObject({ kind: "scaffoldDelivered", scaffoldKind: "hint" });
  await reloadToMap(page);
  await page.getByRole("button", { name: "Misión 1" }).click();
  await expect(page.getByText(/^Pista \d:/)).toHaveCount(3);
});

test("a missed run shows what happened and has no serious accessibility violations", async ({
  page,
}) => {
  await openMission(page);
  await addStudioBlock(page, "Movimiento", "+ Mover", 2);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByTestId("scene-goal-result")).toContainText("Todavía no");
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(violations.map((violation) => violation.id)).toEqual([]);
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1180, height: 820 },
]) {
  test(`mission controls fit ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openMission(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.getByRole("button", { name: "Jugar", exact: true })).toBeVisible();
  });
}
