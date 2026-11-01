import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

// Issues #629 and #628: Java in Escena libre follows the age band and shows which line is running.
async function openScene(page: Page, band?: string) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/kids");
  await page.evaluate((ageBand) => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem("agorix.kids.flags.v1", JSON.stringify(ageBand ? ["ageBands"] : []));
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
    if (ageBand)
      localStorage.setItem(
        "agorix.kids.adults.v1",
        JSON.stringify({ oriSuggestions: true, readAloud: true, dailyLimitMinutes: 30, ageBand }),
      );
  }, band);
  await page.reload();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
}

const languages = (page: Page) => page.getByRole("group", { name: "Código" }).getByRole("button");

test("every language is offered while the age-band switch is off, and Java shows the program", async ({
  page,
}) => {
  await openScene(page);
  await expect(languages(page)).toHaveText(["Agorix Code", "Python", "TypeScript", "Java"]);
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Esperar", exact: true }).click();
  await page.getByRole("button", { name: "Java", exact: true }).click();
  const code = page.locator(".kids-code-strip");
  await expect(code).toContainText("class AgorixProgram extends Sprite {");
  await expect(code).toContainText("move(40);");
  await expect(code).toContainText("waitSeconds(1);");
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
});

test("the line of the stepped block is highlighted in Java and in the other languages", async ({
  page,
}) => {
  await openScene(page);
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
  await page.getByRole("button", { name: "Java", exact: true }).click();
  await expect(page.getByTestId("code-current")).toHaveCount(0);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("button", { name: "Paso", exact: true }).click();
  await expect(page.getByTestId("code-current")).toHaveText("move(40);");
  await page.getByRole("button", { name: "Paso", exact: true }).click();
  await expect(page.getByTestId("code-current")).toHaveText("turn(90);");
  await page.getByRole("button", { name: "Python", exact: true }).click();
  await expect(page.getByTestId("code-current")).toContainText("turn(90)");
  await page.getByRole("button", { name: "Agorix Code", exact: true }).click();
  await expect(page.getByTestId("code-current")).toBeVisible();
});

for (const [band, expected] of [
  ["9-12", ["Agorix Code", "Python", "TypeScript"]],
  ["13+", ["Agorix Code", "Python", "TypeScript", "Java"]],
] as const) {
  test(`the ${band} band offers ${expected.join(", ")}`, async ({ page }) => {
    await openScene(page, band);
    await expect(languages(page)).toHaveText(expected);
  });
}

test("the 6–8 band starts with one language and opens the rest on request", async ({ page }) => {
  await openScene(page, "6-8");
  await expect(languages(page)).toHaveText(["Agorix Code", "Más lenguajes"]);
  await page.getByRole("button", { name: "Más lenguajes" }).click();
  await expect(languages(page)).toHaveText([
    "Agorix Code",
    "Python",
    "TypeScript",
    "Java",
    "Menos lenguajes",
  ]);
  await page.getByRole("button", { name: "Java", exact: true }).click();
  await page.getByRole("button", { name: "Menos lenguajes" }).click();
  // Java is closed again, so the code falls back to the first language.
  await expect(page.locator(".kids-code-strip")).not.toContainText("class AgorixProgram");
});
