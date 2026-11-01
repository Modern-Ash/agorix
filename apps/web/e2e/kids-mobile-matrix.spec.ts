import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "./fixtures.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

// Issues #595 and #598: the main Kids screens on a phone and a tablet have no sideways scroll,
// no control under 44 px, no serious accessibility issue, and Ori never covers Jugar.
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
] as const;

async function seed(page: Page) {
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
}

async function undersized(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const selector =
      "button, a[href], input, select, textarea, [role=button], [role=radio], [role=checkbox]";
    for (const element of document.querySelectorAll<HTMLInputElement>(selector)) {
      if (element.type === "file") continue; // hidden picker behind a labelled button
      if (element.closest(".kids-visually-hidden")) continue;
      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none") continue;
      // A checkbox or radio is touched through its label.
      const box =
        (element.type === "checkbox" || element.type === "radio") && element.closest("label")
          ? element.closest("label")!.getBoundingClientRect()
          : element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (box.width < 44 || box.height < 44)
        out.push(
          `${element.tagName} "${(element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 30)}" ${Math.round(box.width)}x${Math.round(box.height)}`,
        );
    }
    return out;
  });
}

async function check(page: Page, info: TestInfo, name: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${name}: sideways scroll`).toBeLessThanOrEqual(0);
  expect(await undersized(page), `${name}: controls under 44 px`).toEqual([]);
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(
    violations.map((entry) => `${entry.id}:${entry.nodes.length}`),
    `${name}: accessibility`,
  ).toEqual([]);
  await info.attach(`${name}-${page.viewportSize()?.width}.png`, {
    body: await page.screenshot(),
    contentType: "image/png",
  });
}

for (const viewport of VIEWPORTS) {
  test(`main Kids screens fit and stay touchable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport);
    await seed(page);
    await check(page, info, "map");
    await page.getByRole("button", { name: "Crear", exact: true }).click();
    await check(page, info, "create");
    await page.getByRole("button", { name: "Crear escena" }).click();
    await page.getByRole("button", { name: "+ Mover", exact: true }).click();
    await check(page, info, "studio");
    // Ori never sits on top of Jugar.
    const ori = await page.locator(".kids-ori-action").boundingBox();
    const play = await page.getByRole("button", { name: "Jugar", exact: true }).boundingBox();
    if (ori && play)
      expect(
        ori.x < play.x + play.width &&
          ori.x + ori.width > play.x &&
          ori.y < play.y + play.height &&
          ori.y + ori.height > play.y,
      ).toBe(false);
    await page.getByRole("button", { name: "Volver a Crear" }).click();
    await page.getByRole("button", { name: "Mis proyectos" }).click();
    await check(page, info, "projects");
    await page.getByRole("button", { name: "Mapa", exact: true }).click();
    await page.getByRole("button", { name: "Misión 1" }).click();
    await check(page, info, "mission");
  });
}

test("the map names each concept icon in words, visibly and for screen readers", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await expect(page.locator(".kids-concepts")).toContainText("Secuencia");
  await expect(page.getByRole("listitem", { name: /Secuencia/ }).first()).toBeAttached();
});
