import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { reloadToMap } from "./helpers.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

// Issue #612: each world has its own missions, each solvable, and the map shows the progress.
async function start(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/kids");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  });
  await reloadToMap(page);
}

async function play(page: Page, squares: string) {
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  await page.getByRole("combobox", { name: "mover 1" }).selectOption(squares);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sí", exact: true }).click();
}

test("every world shows its own three missions", async ({ page }) => {
  await start(page);
  const titles: Record<string, string[]> = {};
  for (const world of ["Espacio", "Océano", "Robots", "Ciudad"]) {
    await page.getByRole("button", { name: world }).click();
    await expect(page.locator(".kids-world-title")).toHaveText(world);
    titles[world] = await page.locator(".kids-node-title").allTextContents();
    expect(titles[world]).toHaveLength(3);
  }
  expect(titles["Espacio"]).toEqual(["Camino recto", "La esquina", "El zigzag"]);
  expect(titles["Océano"]![0]).toBe("Corriente recta");
  expect(new Set(Object.values(titles).flat()).size).toBe(12);
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
});

test("a world's goal is where its own layout says, and finishing it shows the progress", async ({
  page,
}) => {
  await start(page);
  // Ocean mission 1 is four squares; the same four squares do not reach the city's goal.
  await page.getByRole("button", { name: "Océano" }).click();
  await page.getByRole("button", { name: "Misión 1" }).click();
  await expect(page.getByText("Nadá en línea recta hasta el tesoro.")).toBeVisible();
  await play(page, "4");
  await expect(page.locator(".kids-run-status")).toContainText("Llegaste");
  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await page.getByRole("button", { name: "Océano" }).click();
  await expect(page.locator(".kids-world-progress")).toHaveText("1 de 3 misiones");
  await expect(page.locator(".kids-world-count").nth(1)).toHaveText("1/3");
  await page.getByRole("button", { name: "Espacio" }).click();
  await expect(page.locator(".kids-world-progress")).toHaveText("0 de 3 misiones");

  await page.getByRole("button", { name: "Ciudad" }).click();
  await page.getByRole("button", { name: "Misión 1" }).click();
  await play(page, "4");
  await expect(page.locator(".kids-run-status")).not.toContainText("Llegaste");
  await page.getByRole("combobox", { name: "mover 1" }).selectOption("5");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sí", exact: true }).click();
  await expect(page.locator(".kids-run-status")).toContainText("Llegaste");
});

test("the hints of a world count its own squares", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "Ciudad" }).click();
  await page.getByRole("button", { name: "Misión 1" }).click();
  await page.getByRole("button", { name: "Pista 1", exact: true }).click();
  await page.getByRole("button", { name: "Pista 2", exact: true }).click();
  await expect(
    page.getByText("Pista 2: Contá los cuadritos entre tu personaje y la meta: son 5."),
  ).toBeVisible();
});

test("published missions replace the built-in ones, and an unreachable server leaves them", async ({
  page,
}) => {
  const catalog = {
    ...Object.fromEntries(
      ["space", "ocean", "robots", "city"].map((world) => [
        world,
        [0, 1, 2].map(() => ({
          start: { cx: 0, cy: 2 },
          goal: { cx: 4, cy: 2 },
          title: { es: "Base", en: "Base" },
          story: { es: "Llegá.", en: "Arrive." },
        })),
      ]),
    ),
  } as Record<string, unknown[]>;
  catalog["ocean"] = [
    {
      start: { cx: 1, cy: 0 },
      goal: { cx: 3, cy: 0 },
      title: { es: "Corriente corta", en: "Short current" },
      story: { es: "Nadá un poquito hasta el tesoro.", en: "Swim a little to the treasure." },
    },
    ...(catalog["ocean"] as unknown[]).slice(1),
  ];
  await page.route("**/api/tutor/catalog", (route) => route.fulfill({ json: { catalog } }));
  await start(page);
  await page.getByRole("button", { name: "Océano" }).click();
  await expect(page.locator(".kids-node-title").first()).toHaveText("Corriente corta");
  await page.getByRole("button", { name: "Misión 1" }).click();
  await expect(page.getByText("Nadá un poquito hasta el tesoro.")).toBeVisible();
  // The goal is now two squares away, not four.
  await play(page, "2");
  await expect(page.locator(".kids-run-status")).toContainText("Llegaste");
});

test("without a catalog from the server the built-in missions stay", async ({ page }) => {
  await page.route("**/api/tutor/catalog", (route) => route.fulfill({ status: 503, body: "" }));
  await start(page);
  await page.getByRole("button", { name: "Océano" }).click();
  await expect(page.locator(".kids-node-title").first()).toHaveText("Corriente recta");
});
