import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Issue #373: the Kids shell is reachable at /kids, navigable by touch and keyboard, uses our own
// fonts and never talks to a third party.
test.beforeEach(async ({ page }) => {
  await page.goto("/kids");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("opens in Spanish and walks the onboarding to the map", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "¡Hola!" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await page.getByRole("button", { name: "Seguir" }).click();
  await page.getByRole("button", { name: "🐼" }).click();
  await page.getByRole("button", { name: "Seguir" }).click();
  await page.getByRole("button", { name: "¡Empezar!" }).click();
  await expect(page.getByRole("heading", { name: "Mapa" })).toBeVisible();
  await expect(page.getByRole("navigation")).toBeVisible();
});

test("navigates with the keyboard and keeps the current item marked", async ({ page }) => {
  await page.getByRole("button", { name: "Seguir" }).click();
  await page.getByRole("button", { name: "Seguir" }).click();
  await page.getByRole("button", { name: "¡Empezar!" }).click();
  await page.getByRole("button", { name: /Mis proyectos/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Mis proyectos" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Mis proyectos/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("choosing English switches the copy and survives a reload", async ({ page }) => {
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByText("Which language should we play in?")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Hi!" })).toBeVisible();
});

test("serves its fonts from our own origin and calls no third party", async ({ page }) => {
  const foreign: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith("http") && url.origin !== new URL(page.url()).origin) {
      foreign.push(url.origin);
    }
  });
  await page.reload();
  await page.waitForFunction(() =>
    [...document.fonts].some(
      (font) => font.family.includes("Atkinson Hyperlegible") && font.status === "loaded",
    ),
  );
  expect(foreign).toEqual([]);
});

test("the onboarding and the map pass axe", async ({ page }) => {
  const scan = async () =>
    (
      await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
    ).violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`);
  expect(await scan()).toEqual([]);
  await page.getByRole("button", { name: "Seguir" }).click();
  await page.getByRole("button", { name: "Seguir" }).click();
  await page.getByRole("button", { name: "¡Empezar!" }).click();
  expect(await scan()).toEqual([]);
});
