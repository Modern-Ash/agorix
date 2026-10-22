import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.use({ hasTouch: true, serviceWorkers: "block" });

async function openEditor(page: Page, locale: "es" | "en" = "es") {
  await page.goto("/kids");
  await page.evaluate((lang) => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", lang);
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  }, locale);
  await page.reload();
  await page.getByRole("button", { name: locale === "es" ? "Misión 1" : "Mission 1" }).click();
}

test("builds, predicts, runs, steps and undoes on the real Kids mission", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  await page.getByRole("combobox", { name: "mover 1" }).selectOption("4");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("status")).not.toContainText("Llegaste");
  await page.getByRole("dialog").getByRole("button", { name: "Sí", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Llegaste");
  await expect(page.locator(".kids-world-avatar")).toHaveText("🐸");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("agorix:kids.space.kids.m1.straight") ?? "null")?.metadata
            ?.missionProgress,
      ),
    )
    .toBe(1);
  await page.getByRole("button", { name: "Volver", exact: true }).click();
  await page.getByRole("button", { name: "Paso", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "No sé" }).click();
  await expect(page.getByRole("status")).toContainText("Llegaste");
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByRole("combobox", { name: "mover 1" })).toHaveValue("1");
  await page.getByRole("button", { name: "Rehacer" }).click();
  await expect(page.getByRole("combobox", { name: "mover 1" })).toHaveValue("4");
  await page.getByRole("button", { name: "Código", exact: true }).click();
  await page.getByRole("button", { name: "Python" }).click();
  await expect(page.locator(".kids-code-view")).toContainText("move(160)");
  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await expect(page.locator(".kids-stars")).toHaveText("★1");
  await page.getByRole("button", { name: "Misión 1" }).click();
  await expect(page.getByRole("combobox", { name: "mover 1" })).toHaveValue("4");
});

test("records prediction and post-run revision from editor actions only", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("agorix.kids.reflections.v1")))
    .toBeNull();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sí", exact: true }).click();
  await page.getByRole("combobox", { name: "mover 1" }).selectOption("2");
  const events = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("agorix.kids.reflections.v1") ?? "[]"),
  );
  expect(events.map((event: { kind: string }) => event.kind)).toEqual([
    "predictionMade",
    "programRevisedAfterExecution",
  ]);
  expect(events[0]).toMatchObject({ prediction: "reachGoal", matchedRuntimeOutcome: false });
  expect(events[1]).toMatchObject({ changedNodeCount: 1, afterUnsuccessfulRun: true });
  expect(JSON.stringify(events)).not.toMatch(/timestamp|freeText|transcript/);
});

test("reveals hints in order and records only the levels opened", async ({ page }) => {
  await openEditor(page);
  await expect(page.getByRole("button", { name: "Ver idea" })).toHaveCount(0);
  for (let level = 1; level <= 4; level++) {
    await page.getByRole("button", { name: `Pista ${level}` }).click();
  }
  await page.getByRole("button", { name: "Ver idea" }).click();
  const events = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("agorix.kids.reflections.v1") ?? "[]"),
  );
  expect(events.map((event: { level: number }) => event.level)).toEqual([1, 2, 3, 4, 5]);
  expect(events.at(-1)).toMatchObject({ kind: "scaffoldDelivered", scaffoldKind: "solution" });
  await page.reload();
  await page.getByRole("button", { name: "Misión 1" }).click();
  await expect(page.locator(".kids-hints .kids-note")).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Ver idea" })).toHaveCount(0);
});

test("shows wall evidence and has no serious accessibility violations", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  await page.getByRole("combobox", { name: "mover 1" }).selectOption("5");
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "No", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Chocó con el borde");
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(violations.map((violation) => violation.id)).toEqual([]);
});

test("palette works by keyboard and repeat executes its child blocks", async ({ page }) => {
  await openEditor(page, "en");
  const repeat = page.getByRole("button", { name: "+ repeat", exact: true });
  await repeat.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
  await page.locator(".kids-repeat-add").getByRole("button", { name: "+ move" }).click();
  await page.getByRole("combobox", { name: "move 1" }).last().selectOption("2");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Not sure" }).click();
  await expect(page.getByRole("status")).toContainText("reached");
  await expect(page.locator(".kids-program-block[data-active=true]")).toHaveCount(1);
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1180, height: 820 },
]) {
  test(`editor controls fit ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openEditor(page);
    const result = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const buttons = [...document.querySelectorAll<HTMLElement>(".kids-editor button")].filter(
        (button) => button.getBoundingClientRect().width > 0,
      );
      return buttons
        .filter((button) => {
          const rect = button.getBoundingClientRect();
          return rect.width < 44 || rect.height < 44 || rect.left < -1 || rect.right > width + 1;
        })
        .map((button) => button.textContent?.trim());
    });
    expect(result).toEqual([]);
  });
}
