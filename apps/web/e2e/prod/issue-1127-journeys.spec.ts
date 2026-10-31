import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Anonymous, browser-local journeys. The caller pins AGORIX_EXPECT_SHA before attributing evidence.
const expectedSha = process.env["AGORIX_EXPECT_SHA"];

test.beforeEach(async ({ request }) => {
  expect(expectedSha, "Pin AGORIX_EXPECT_SHA for issue #1127 evidence").toMatch(/^[0-9a-f]{12}$/);
  const response = await request.get("/version.json");
  expect(response.ok()).toBe(true);
  expect((await response.json()).sha).toBe(expectedSha);
});

async function enterFromFreshBrowser(page: Page) {
  await page.goto("/");
  expect(await page.evaluate(() => localStorage.getItem("agorix.kids.flags.v1"))).toBeNull();
  await page.getByRole("button", { name: "Seguir" }).click();
  await page.getByRole("button", { name: "Seguir" }).click();
  await page.getByRole("button", { name: "¡Empezar!" }).click();
}

test("Scratch-familiar creation reaches runtime, code and saved project", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await enterFromFreshBrowser(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  await expect(page).toHaveURL(/#\/escena\//);
  await expect(page.getByRole("navigation", { name: "Categorías de bloques" })).toBeVisible();
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
  const code = page.locator(".kids-code-strip");
  await expect(code).toContainText(/mover|move/i);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText(/1 bloque ejecutado/)).toBeVisible();
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(0);
  await page.getByRole("button", { name: "Rehacer" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("scene.png"), fullPage: true });
  await page.reload();
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("agorix.kids.flags.v1"))).toBeNull();
});

test("new learner reaches a mission and reviews Ori's offline proposal", async ({
  page,
}, testInfo) => {
  await page.route("**/api/tutor/ori", (route) => route.fulfill({ status: 503, body: "" }));
  await enterFromFreshBrowser(page);
  await expect(page.getByRole("button", { name: "Misión 1" })).toBeVisible();
  await page.getByRole("button", { name: "Misión 1" }).click();
  await page.getByRole("button", { name: "Pista 1", exact: true }).click();
  await page.getByRole("button", { name: "Pista 2", exact: true }).click();
  await page.getByRole("button", { name: "Abrir propuesta de Ori" }).click();
  await expect(page.locator(".kids-ori-proposal")).toBeVisible();
  await expect(page.locator(".kids-program-block")).toHaveCount(0);
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("mission-proposal.png"), fullPage: true });
});
