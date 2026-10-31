import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.use({ hasTouch: true, serviceWorkers: "block" });

const viewports = [
  { width: 1280, height: 800 },
  { width: 820, height: 1180 },
  { width: 390, height: 844 },
] as const;

async function beginFreshScene(page: Page) {
  await page.addInitScript(() => localStorage.setItem("agorix.locale", "es"));
  await page.goto("/kids");
  expect(await page.evaluate(() => localStorage.getItem("agorix.kids.flags.v1"))).toBeNull();
  await page.getByRole("button", { name: "Seguir" }).click();
  await page.getByRole("button", { name: "Seguir" }).click();
  await page.getByRole("button", { name: "¡Empezar!" }).click();
  await expect(page.getByRole("heading", { name: "Mapa" })).toBeVisible();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  await expect(page.getByRole("heading", { name: "Escena libre" })).toBeVisible();
}

for (const viewport of viewports) {
  test(`fresh creative scene keeps blocks, code, actors and saved work at ${viewport.width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport);
    await beginFreshScene(page);
    const categories = page.getByRole("navigation", { name: "Categorías de bloques" });
    await expect(categories.getByRole("button")).toHaveCount(8);
    const palette = page.locator(".kids-studio-palette");
    const blocks = page.locator(".kids-program-drop > .kids-program-block");
    const move = palette.getByRole("button", { name: "+ Mover", exact: true });

    // The desktop gesture has a non-drag keyboard path on every viewport.
    if (viewport.width === 1280) {
      await move.scrollIntoViewIfNeeded();
      const from = (await move.boundingBox())!;
      const target = page.locator(".kids-program-drop");
      const beforeScroll = await page.evaluate(() => window.scrollY);
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 20, {
        steps: 3,
      });
      await page.mouse.move(from.x + from.width / 2, 20, { steps: 8 });
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(beforeScroll);
      await expect
        .poll(() =>
          target.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return rect.top >= 0 && rect.bottom <= window.innerHeight;
          }),
        )
        .toBe(true);
      const to = (await target.boundingBox())!;
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
      await page.mouse.up();
    } else {
      await move.focus();
      await move.press("Enter");
    }
    await expect(blocks).toHaveCount(1);
    const turn = palette.getByRole("button", { name: "+ Girar a la derecha", exact: true });
    await turn.focus();
    await turn.press("Enter");
    await expect(blocks).toHaveCount(2);
    await palette.getByRole("button", { name: "Repetir estos bloques", exact: true }).click();
    await expect(blocks).toHaveCount(1);
    await expect(page.locator(".kids-program-drop .kids-nested-block")).toHaveCount(2);
    await expect(page.locator(".kids-code-strip")).toContainText(/repeat|repetir/i);

    await page.getByRole("button", { name: "+ Agregar personaje" }).click();
    const actors = page.getByRole("group", { name: "Personajes" }).getByRole("button");
    await expect(actors).toHaveCount(2);
    await page.getByRole("button", { name: "+ Sonar", exact: true }).click();
    await expect(blocks).toHaveCount(1);
    await actors.first().click();
    await expect(page.locator(".kids-program-drop .kids-nested-block")).toHaveCount(2);
    await page.getByRole("button", { name: "Jugar", exact: true }).click();
    await expect(page.getByText(/bloques ejecutados/)).toBeVisible();
    await actors.nth(1).click();
    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect(blocks).toHaveCount(0);
    await page.getByRole("button", { name: "Rehacer" }).click();
    await expect(blocks).toHaveCount(1);
    await page.reload();
    await expect(actors).toHaveCount(2);
    await actors.first().click();
    await expect(page.locator(".kids-program-drop .kids-nested-block")).toHaveCount(2);
    const violations = (
      await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
    ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
    expect(violations.map((entry) => entry.id)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewport.width,
    );
    await info.attach(`creative-${viewport.width}.png`, {
      body: await page.screenshot(),
      contentType: "image/png",
    });
    expect(await page.evaluate(() => localStorage.getItem("agorix.kids.flags.v1"))).toBeNull();
  });
}

test("an offscreen palette drag released outside the program adds nothing and stops scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await beginFreshScene(page);
  const add = page.getByRole("button", { name: "+ Mover", exact: true });
  await add.scrollIntoViewIfNeeded();
  const from = (await add.boundingBox())!;
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 20, { steps: 3 });
  await page.mouse.move(10, 20, { steps: 8 });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(before);
  await page.mouse.up();
  await expect(page.locator(".kids-drag-ghost")).toHaveCount(0);
  await expect(page.locator(".kids-program-block")).toHaveCount(0);
  const after = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.scrollY)).toBe(after);
});
