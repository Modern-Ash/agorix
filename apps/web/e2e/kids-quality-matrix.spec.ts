import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { passAdultGate, reloadTo } from "./helpers.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

// Issue #631: one reproducible journey per device size, with the safety properties that must hold
// through all of it: nothing leaves this origin, the page's own security policy is never broken,
// the app works offline, accessibility holds on every screen, and what was done is still there
// after a reload.
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
] as const;

interface Watch {
  readonly foreign: string[];
  readonly policy: string[];
  readonly crashes: string[];
}

async function watch(page: Page, origin: string): Promise<Watch> {
  const seen: Watch = { foreign: [], policy: [], crashes: [] };
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (["http:", "https:"].includes(url.protocol) && url.origin !== origin) {
      seen.foreign.push(url.origin);
    }
  });
  page.on("pageerror", (error) => seen.crashes.push(error.message));
  await page.addInitScript(() => {
    (window as unknown as { __policy: string[] }).__policy = [];
    document.addEventListener("securitypolicyviolation", (event) =>
      (window as unknown as { __policy: string[] }).__policy.push(
        `${event.violatedDirective}:${event.blockedURI}`,
      ),
    );
  });
  return seen;
}

async function policyViolations(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __policy?: string[] }).__policy ?? []);
}

async function axe(page: Page, name: string) {
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(
    violations.map((entry) => entry.id),
    `${name}: accessibility`,
  ).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${name}: sideways scroll`).toBeLessThanOrEqual(0);
}

for (const viewport of VIEWPORTS) {
  test(`a child's whole journey works, offline too, and stays private at ${viewport.width}x${viewport.height}`, async ({
    page,
    context,
    baseURL,
  }) => {
    await page.setViewportSize(viewport);
    const seen = await watch(page, new URL(baseURL!).origin);
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
    await reloadTo(page, "#/mapa");
    await axe(page, "map");

    // A mission: build, predict, run and reach the goal.
    await page.getByRole("button", { name: "Misión 1" }).click();
    await page.getByRole("button", { name: "+ mover", exact: true }).click();
    await page.getByRole("combobox", { name: "mover 1" }).selectOption("4");
    await page.getByRole("button", { name: "Jugar", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Sí", exact: true }).click();
    await expect(page.locator(".kids-run-status")).toContainText("Llegaste");
    await axe(page, "mission");

    // The work is still there after a reload.
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("agorix.kids.progress.v1") ?? "{}")?.done !==
              undefined &&
            Object.keys(JSON.parse(localStorage.getItem("agorix.kids.progress.v1") ?? "{}").done)
              .length,
        ),
      )
      .toBeGreaterThan(0);
    await reloadTo(page, "#/mapa");
    await page.getByRole("button", { name: "Misión 1" }).click();
    await expect(page.getByRole("combobox", { name: "mover 1" })).toHaveValue("4");

    // Offline: a free scene is built, played and saved with the network cut.
    await page.getByRole("button", { name: "Volver al mapa" }).click();
    await page.getByRole("button", { name: "Crear", exact: true }).click();
    await page.getByRole("button", { name: "Crear escena" }).click();
    await context.setOffline(true);
    await page.getByRole("button", { name: "+ Mover", exact: true }).click();
    await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
    await page.getByRole("button", { name: "+ Mover", exact: true }).click();
    await page.getByRole("button", { name: "Jugar", exact: true }).click();
    await expect(page.getByText("3 bloques ejecutados")).toBeVisible();
    await axe(page, "studio offline");
    await context.setOffline(false);

    // Adults see counts only, and they match what happened.
    await reloadTo(page, "#/mapa");
    await page.getByRole("button", { name: "Adultos" }).click();
    await passAdultGate(page);
    const indicators = page.getByRole("region", { name: "Indicadores de aprendizaje" });
    await expect(indicators).toContainText("Autonomía");
    await expect(indicators).toContainText("2 corridas");
    await axe(page, "adults");
    const stored = await page.evaluate(() => localStorage.getItem("agorix.kids.indicators.v1"));
    expect(stored).not.toMatch(/mover|girar|Nova|🐸/);

    expect(seen.foreign, "requests to another origin").toEqual([]);
    expect(await policyViolations(page), "security policy violations").toEqual([]);
    expect(seen.crashes, "uncaught errors").toEqual([]);
  });
}
