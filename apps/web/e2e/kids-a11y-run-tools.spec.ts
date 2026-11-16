import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures.js";
import { clickCreateScene } from "./helpers.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

// The tools around a finished run (what changed, compare with last time, replay files, rewind, a
// goal about a value): each is reachable with the keyboard alone, has a name a screen reader says,
// and the page has no serious or critical axe violation while they are open (#1602, #1603, #1604).

async function openScene(page: Page, width: number) {
  await page.setViewportSize({ width, height: 844 });
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
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await clickCreateScene(page);
}

async function expectNoViolations(page: Page, where: string) {
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(
    violations.map(
      (entry) => `${entry.id}: ${entry.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
    ),
    where,
  ).toEqual([]);
}

for (const width of [390, 1280]) {
  test(`the run tools are named, keyboard-reachable and pass axe at ${width}px`, async ({
    page,
  }) => {
    await openScene(page, width);
    await page.getByRole("textbox", { name: "Nombre" }).fill("Puntos");
    await page.getByRole("button", { name: "+ Crear variable" }).click();
    await page.getByRole("spinbutton", { name: "Número" }).fill("7");
    await page.getByRole("button", { name: "+ Fijar valor" }).click();
    for (let i = 0; i < 2; i++)
      await page.getByRole("button", { name: "+ Mover", exact: true }).click();
    const play = page.getByRole("button", { name: "Jugar", exact: true });
    await play.click();
    await expect(page.locator(".kids-replay-button")).toBeEnabled();
    await play.click();
    await expect(page.locator(".kids-replay-button")).toBeEnabled();

    // Every control around the run has a name a screen reader says.
    for (const name of ["Retroceder", "Guardar repetición"])
      await expect(page.getByRole("button", { name, exact: true }), name).toBeVisible();
    for (const name of ["Abrir repetición", "Línea de tiempo"])
      await expect(page.getByLabel(name).first(), name).toBeAttached();

    // The two details open and close with the keyboard.
    for (const summary of ["Qué cambió", "Comparar con la vez anterior"]) {
      const element = page.locator("summary", { hasText: summary });
      await element.focus();
      await page.keyboard.press("Enter");
      await expect(element.locator(".."), summary).toHaveAttribute("open", "");
    }
    await expectNoViolations(page, "run tools open");

    // Rewind and the change buttons work from the keyboard.
    const rewind = page.getByRole("button", { name: "Retroceder", exact: true });
    await rewind.focus();
    await page.keyboard.press("Enter");
    const change = page.getByRole("button", { name: /Paso 1: Puntos 0 → 7/ });
    await change.focus();
    await page.keyboard.press("Enter");
    await expect(change).toHaveAttribute("aria-current", "step");
    await expectNoViolations(page, "after the keyboard steps");
  });

  test(`a goal about a value is announced and passes axe at ${width}px`, async ({ page }) => {
    await openScene(page, width);
    await page.getByRole("textbox", { name: "Nombre" }).fill("Puntos");
    await page.getByRole("button", { name: "+ Crear variable" }).click();
    const choose = page.getByRole("combobox", { name: "Elegir una meta" });
    await choose.focus();
    await choose.selectOption({ label: "Puntos llega a 5" });
    await expect(page.getByTestId("scene-goal")).toHaveText("Puntos llega a 5");
    await expectNoViolations(page, "goal about a value");
  });
}
