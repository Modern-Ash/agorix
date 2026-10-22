import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

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
