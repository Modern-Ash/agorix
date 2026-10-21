import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Issue #362: axe against the home screen and First Mission in both languages.
// Serious and critical findings fail the build; moderate/minor ones are reported in the log.

async function open(page: Page, locale: "es" | "en") {
  await page.goto("/");
  await page.evaluate((value) => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", value);
  }, locale);
  await page.reload();
  await expect(page.locator(".learning-layout")).toBeVisible();
}

async function scan(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  const advisory = results.violations.filter((violation) => !blocking.includes(violation));
  if (advisory.length > 0) {
    console.log(
      "axe advisory:",
      advisory.map((v) => `${v.id}(${v.impact}, ${v.nodes.length})`).join(", "),
    );
  }
  return blocking.map(
    (violation) =>
      `${violation.id} [${violation.impact}] ${violation.nodes.length} node(s): ${violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(" "))
        .join(" | ")}`,
  );
}

for (const locale of ["es", "en"] as const) {
  test(`home screen has no serious or critical a11y violations (${locale})`, async ({ page }) => {
    await open(page, locale);
    expect(await scan(page)).toEqual([]);
  });

  test(`First Mission with blocks, run result and the AI panel open (${locale})`, async ({
    page,
  }) => {
    await open(page, locale);
    await page.locator(".primary-start").click();
    await page
      .locator(".stage-panel")
      .getByRole("button", { name: /^(Run|Ejecutar)$/ })
      .click();
    await page.getByRole("button", { name: /hint tool|pista de IA/i }).click();
    expect(await scan(page)).toEqual([]);
  });
}

test("the app menu and the language picker are accessible (es)", async ({ page }) => {
  await open(page, "es");
  const menu = page.getByRole("button", { name: /Mostrar menú/ });
  if (await menu.isVisible().catch(() => false)) await menu.click();
  expect(await scan(page)).toEqual([]);
});
