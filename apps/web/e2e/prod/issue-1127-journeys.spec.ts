import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "../fixtures.js";
import { openAdultTab, passAdultGate } from "../helpers.js";

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

test.describe("touch and learner authority", () => {
  test.use({ hasTouch: true, serviceWorkers: "block" });

  test("a phone can reject, accept and undo an offline Ori idea without losing saved work", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/api/tutor/studio/ori", (route) =>
      route.fulfill({ status: 503, body: "" }),
    );
    await enterFromFreshBrowser(page);
    await page.getByRole("button", { name: "Crear", exact: true }).tap();
    await page.getByRole("button", { name: "Crear escena" }).tap();
    await page.getByRole("button", { name: "+ Mover", exact: true }).tap();
    const blocks = page.locator(".kids-program-block");
    await expect(blocks).toHaveCount(1);
    await page.getByRole("button", { name: "Mostrar ayuda de Ori" }).tap();
    await page.getByRole("button", { name: "Pedirle una idea a Ori" }).tap();
    await expect(page.getByTestId("ori-ghost-block")).toHaveCount(1);
    await expect(blocks).toHaveCount(1);
    await page.getByRole("button", { name: "No usar" }).tap();
    await expect(page.getByTestId("ori-ghost-block")).toHaveCount(0);
    await expect(blocks).toHaveCount(1);
    await page.getByRole("button", { name: "Pedirle una idea a Ori" }).tap();
    await page.getByRole("button", { name: "Usar idea" }).tap();
    await expect(blocks).toHaveCount(2);
    await page.getByRole("button", { name: "Deshacer" }).tap();
    await expect(blocks).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath("touch-ori-undo.png"), fullPage: true });
    await page.reload();
    await expect(blocks).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    expect(await page.evaluate(() => localStorage.getItem("agorix.kids.flags.v1"))).toBeNull();
  });
});

test("a locally saved scene survives reopening and portable export/import", async ({ page }) => {
  await enterFromFreshBrowser(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
  await page.getByRole("button", { name: "Volver a Crear" }).click();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  const scene = page.getByRole("article").filter({ hasText: "Escena libre" });
  await expect(scene).toBeVisible();
  await scene.getByRole("button", { name: "Jugar" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
  await page.getByRole("button", { name: "Volver a Crear" }).click();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Exportar" })
    .click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.agorix$/);
  const exported = await readFile(await file.path()!);
  await page.getByLabel("Importar .agorix").setInputFiles({
    name: "scene.agorix",
    mimeType: "application/json",
    buffer: exported,
  });
  await expect(page.getByRole("heading", { name: "Escena libre" })).toBeVisible();
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
});

for (const [band, index, width, height] of [
  ["6-8", 0, 1280, 800],
  ["9-12", 1, 820, 1180],
  ["13+", 2, 390, 844],
] as const) {
  test(`an adult selects ${band} and the full creative palette stays available at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height });
    await enterFromFreshBrowser(page);
    await page.getByRole("button", { name: "Adultos" }).click();
    await passAdultGate(page);
    await openAdultTab(page, "Ajustes");
    await page.getByRole("radio").nth(index).check();
    await expect(page.locator('input[name="kids-age-band"]:checked')).toHaveValue(band);
    await page.getByRole("button", { name: "Mapa", exact: true }).click();
    await page.getByRole("button", { name: "Crear", exact: true }).click();
    await page.getByRole("button", { name: "Crear escena" }).click();
    await expect(page.locator(".kids-root")).toHaveAttribute("data-age-band", band);
    await expect(
      page.getByRole("navigation", { name: "Categorías de bloques" }).getByRole("button"),
    ).toHaveCount(8);
    await expect(page.getByRole("button", { name: "+ Mover", exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`scene-${band}.png`), fullPage: true });
    expect(await page.evaluate(() => localStorage.getItem("agorix.kids.flags.v1"))).toBeNull();
  });
}

test("adult extension switches hide Pen and Music without hiding the core palette", async ({
  page,
}) => {
  await enterFromFreshBrowser(page);
  await page.getByRole("button", { name: "Adultos" }).click();
  await passAdultGate(page);
  await openAdultTab(page, "Ajustes");
  const pen = page.getByRole("switch", { name: /Paquete Lápiz/ });
  const music = page.getByRole("switch", { name: /Paquete Música/ });
  await expect(pen).toHaveAttribute("aria-checked", "true");
  await expect(music).toHaveAttribute("aria-checked", "true");
  await pen.click();
  await music.click();
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  await expect(page.getByRole("group", { name: "Lápiz" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Música" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "+ Mover", exact: true })).toBeVisible();
});

test("Ori's contextual compound idea can be changed and undone before a run", async ({ page }) => {
  await enterFromFreshBrowser(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  const conditions = page.getByRole("group", { name: "Combinar condiciones" });
  await conditions.getByRole("button", { name: "Pedirle a Ori una combinación" }).click();
  const proposal = page.getByTestId("ori-compound-proposal");
  await expect(proposal).toContainText("todavía no está en tu programa");
  await expect(page.locator(".kids-program-block")).toHaveCount(0);
  await proposal.getByRole("button", { name: "Cambiar idea" }).click();
  await expect(page.locator(".kids-program-block")).toContainText("o");
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(0);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText(/0 bloques ejecutados/)).toBeVisible();
});
