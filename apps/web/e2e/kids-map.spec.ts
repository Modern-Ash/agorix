import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures.js";

// Issue #374: onboarding (language, avatar, meet Ori) and the world map with mission locks.
test.use({ hasTouch: true });

const PROGRESS_KEY = "agorix.kids.progress.v1";

async function seed(page: Page, progress: object | null, locale: "es" | "en" = "es") {
  await page.goto("/kids");
  await page.evaluate(
    ({ key, value, lang }) => {
      localStorage.clear();
      localStorage.setItem("agorix.locale", lang);
      if (value !== null) localStorage.setItem(key, JSON.stringify(value));
    },
    { key: PROGRESS_KEY, value: progress, lang: locale },
  );
  await page.reload();
}

const SEEDED = {
  onboarded: true,
  avatar: "🐸",
  stars: 2,
  done: { "space:0": true, "ocean:0": true },
};

test("onboarding keeps the language and avatar and lands on the map after a reload", async ({
  page,
}) => {
  await seed(page, null);
  await expect(page.getByRole("heading", { name: "¡Hola!" })).toBeVisible();
  await page.getByRole("button", { name: "English" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "🐼" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("I’m Ori. I give ideas, but you decide.")).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("button", { name: "🐼" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Let’s go!" }).click();
  await expect(page.locator(".kids-avatar-badge")).toHaveText("🐼");

  await page.reload();
  await expect(page.locator(".kids-map")).toBeVisible();
  await expect(page.locator(".kids-avatar-badge")).toHaveText("🐼");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("the map shows stars, concept states and mission locks from saved progress", async ({
  page,
}) => {
  await seed(page, SEEDED);
  await expect(page.locator(".kids-stars")).toHaveText("★2");
  const concepts = page.locator(".kids-concept");
  await expect(concepts.nth(0)).toHaveAttribute("aria-label", "Secuencia: Logrado ★");
  await expect(concepts.nth(1)).toHaveAttribute("aria-label", "Giros: Practicando");
  await expect(concepts.nth(2)).toHaveAttribute("aria-label", "Repetición: Próximo");

  // Space: mission 1 done, 2 current, 3 locked.
  await expect(page.locator(".kids-node.done")).toHaveCount(1);
  await expect(page.locator(".kids-node.current")).toContainText("Jugar");
  await expect(page.getByRole("button", { name: "Misión 3" })).toBeDisabled();
  await expect(page.locator(".kids-node-star")).toHaveCount(1);

  await page.getByRole("button", { name: "Robots" }).click();
  await expect(page.locator(".kids-node.done")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Misión 1" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Misión 2" })).toBeDisabled();
});

test("a locked mission cannot be opened and the current one opens the editor", async ({ page }) => {
  await seed(page, SEEDED);
  await expect(page.getByRole("button", { name: "Misión 3" })).toBeDisabled();
  await page.locator(".kids-node.current").click();
  await expect(page.locator("[data-screen='editor']")).toBeVisible();
  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await expect(page.locator(".kids-map")).toBeVisible();
});

for (const viewport of [
  { name: "phone 390x844", width: 390, height: 844 },
  { name: "tablet portrait 820x1180", width: 820, height: 1180 },
  { name: "tablet landscape 1180x820", width: 1180, height: 820 },
]) {
  for (const locale of ["es", "en"] as const) {
    test(`onboarding and map fit ${viewport.name} in ${locale}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const check = async () =>
        page.evaluate(() => {
          const width = document.documentElement.clientWidth;
          const controls = [...document.querySelectorAll<HTMLElement>(".kids-root button")].filter(
            (element) => {
              const box = element.getBoundingClientRect();
              return box.width > 0 && box.height > 0;
            },
          );
          const label = (e: HTMLElement) =>
            (e.getAttribute("aria-label") ?? e.textContent ?? "").trim().slice(0, 24);
          return {
            clipped: controls
              .filter((e) => {
                const box = e.getBoundingClientRect();
                return box.right > width + 1 || box.left < -1;
              })
              .map(label),
            small: controls
              .filter((e) => {
                const box = e.getBoundingClientRect();
                return box.width < 44 || box.height < 44;
              })
              .map(label),
          };
        });

      await seed(page, null, locale);
      for (let step = 0; step < 3; step += 1) {
        expect(await check(), `onboarding step ${step}`).toEqual({ clipped: [], small: [] });
        if (step < 2) {
          await page.locator(".kids-next").click();
        }
      }
      await page.locator(".kids-next").click();
      expect(await check(), "map").toEqual({ clipped: [], small: [] });
    });
  }
}

test("the map passes axe in both languages", async ({ page }) => {
  for (const locale of ["es", "en"] as const) {
    await seed(page, SEEDED, locale);
    const violations = (
      await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
    ).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  }
});

// Issue #1111: a visible title with overall progress, concepts in words, worlds without scrolling.
test("the map heading counts every world and nothing scrolls sideways on a phone", async ({
  page,
}) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await seed(page, SEEDED);
    await expect(page.getByRole("heading", { level: 1, name: "Mapa" })).toBeVisible();
    await expect(page.locator(".kids-map-summary")).toHaveText("2 de 12 misiones");
    await expect(page.locator(".kids-concepts")).toContainText("Secuencia");
    await expect(page.locator(".kids-concepts")).toContainText("Repetición");
    const layout = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const tabs = document.querySelector<HTMLElement>(".kids-world-tabs")!;
      const small = [...document.querySelectorAll<HTMLElement>(".kids-map button")]
        .filter((button) => {
          const rect = button.getBoundingClientRect();
          return (
            rect.width > 0 &&
            (rect.left < -1 || rect.right > width + 1 || rect.width < 44 || rect.height < 44)
          );
        })
        .map((button) => button.getAttribute("aria-label") ?? button.textContent?.trim());
      return {
        sideways: document.documentElement.scrollWidth > width,
        tabsScroll: tabs.scrollWidth > tabs.clientWidth,
        small,
      };
    });
    expect(layout, `${width} px`).toEqual({ sideways: false, tabsScroll: false, small: [] });
    const violations = (
      await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
    ).violations.filter((item) => item.impact === "serious" || item.impact === "critical");
    expect(
      violations.map((item) => item.id),
      `${width} px`,
    ).toEqual([]);
  }
});

test("the age-band notice can be put away for this visit and comes back on reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/kids");
  await page.evaluate(
    ({ key, value }) => {
      localStorage.clear();
      localStorage.setItem("agorix.locale", "es");
      localStorage.setItem("agorix.kids.flags.v1", JSON.stringify(["ageBands"]));
      localStorage.setItem(key, JSON.stringify(value));
    },
    { key: PROGRESS_KEY, value: SEEDED },
  );
  await page.reload();
  const notice = page.locator(".kids-band-ask");
  await expect(notice).toBeVisible();
  const before = await page.evaluate(() => JSON.stringify(localStorage));
  await notice.getByRole("button", { name: "Cerrar aviso" }).click();
  await expect(notice).toHaveCount(0);
  // Closing stores nothing: the notice is back on the next visit.
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(before);
  await page.reload();
  await expect(page.locator(".kids-band-ask")).toBeVisible();
});

test("the map says what to do next, opens that mission, explains locks and leads to Crear", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/kids");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  });
  await page.reload();
  const next = page.getByTestId("map-next");
  await expect(next.getByRole("button", { name: /^Seguir con/ })).toContainText("Camino recto");
  await expect(page.getByText("Terminá la misión 1 para abrirla")).toBeVisible();
  // Each mission says what to do and which idea it teaches, not just a title.
  await expect(page.getByText("Ordená los pasos para llegar a la meta.").first()).toBeVisible();
  await expect(page.getByText("Aprendés: Giros")).toBeVisible();
  await expect(page.getByText("Aprendés: Repetición")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await next.getByRole("button", { name: /Crear sin misiones/ }).click();
  await expect(page.getByRole("heading", { name: "Crear", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mapa" }).click();
  await page
    .getByTestId("map-next")
    .getByRole("button", { name: /^Seguir con/ })
    .click();
  await expect(page).toHaveURL(/#\/mision\/1\//);
});
