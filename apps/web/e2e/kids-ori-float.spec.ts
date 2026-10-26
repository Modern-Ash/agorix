import { expect, test, type Page } from "@playwright/test";

test.use({ hasTouch: true, serviceWorkers: "block" });

async function open(page: Page, enabled: boolean) {
  await page.goto("/kids");
  await page.evaluate((flag) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem("agorix.kids.flags.v1", JSON.stringify(flag ? ["oriFloat"] : []));
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  }, enabled);
  await page.reload();
  await page.getByRole("button", { name: "Misión 1" }).click();
}

async function earnOriIdea(page: Page) {
  if (await page.getByRole("button", { name: "Abrir propuesta de Ori" }).count()) return;
  for (const name of ["Pista 1", "Pista 2"]) {
    const hint = page.getByRole("button", { name, exact: true });
    if (await hint.count()) await hint.click();
  }
}

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 820, height: 1180 },
  { width: 390, height: 844 },
]) {
  test(`Ori floats without covering controls at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await open(page, true);
    await earnOriIdea(page);
    const trigger = page.getByRole("button", { name: "Abrir propuesta de Ori" });
    await expect(trigger).toBeVisible();
    const bubble = await trigger.boundingBox();
    const run = await page.getByRole("button", { name: "Jugar", exact: true }).boundingBox();
    const palette = await page.locator(".kids-palette-block").last().boundingBox();
    expect(bubble && run && overlaps(bubble, run)).toBe(false);
    expect(bubble && palette && overlaps(bubble, palette)).toBe(false);
    await trigger.click();
    await expect(page.getByRole("dialog", { name: "Propuesta de Ori" })).toBeVisible();
    await page.getByRole("button", { name: "Cerrar propuesta" }).click();
    await expect(trigger).toBeVisible();
  });
}

test("floating Ori keeps accept, modify and reject evidence", async ({ page }) => {
  for (const decision of ["accept", "modify", "reject"] as const) {
    await open(page, true);
    await earnOriIdea(page);
    await page.getByRole("button", { name: "Abrir propuesta de Ori" }).click();
    const proposal = page.getByRole("dialog", { name: "Propuesta de Ori" });
    await proposal.getByRole("button", { name: "Ver cambios" }).click();
    if (decision === "modify") {
      await proposal.getByRole("combobox").selectOption("3");
      await proposal.getByRole("button", { name: "Usar y cambiar" }).click();
    } else {
      await proposal
        .getByRole("button", { name: decision === "accept" ? "Usar" : "No, gracias", exact: true })
        .click();
    }
    const events = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem("agorix.kids.reflections.v1") ?? "[]"),
    );
    expect(events.at(-1)).toMatchObject({ kind: "proposalDecided", decision });
  }
});

test("flag off keeps the existing inline proposal", async ({ page }) => {
  await open(page, false);
  await earnOriIdea(page);
  await expect(page.locator(".kids-ori-proposal")).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir propuesta de Ori" })).toHaveCount(0);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`Ori's panel does not block the stage at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await open(page, true);
    await earnOriIdea(page);
    const trigger = page.getByRole("button", { name: "Abrir propuesta de Ori" });
    await trigger.click();
    const panel = page.getByRole("dialog", { name: "Propuesta de Ori" });
    await expect(panel).toBeVisible();
    // Not modal: the rest of the editor is still reachable and still operable.
    await expect(panel).not.toHaveAttribute("aria-modal", "true");
    const run = page.getByRole("button", { name: "Jugar", exact: true });
    await run.click();
    await expect(panel).toBeVisible();
    // The idea is previewed in the program as a ghost block that is not saved.
    await expect(page.getByTestId("ori-ghost-block").first()).toContainText("Idea de Ori");
    expect(await page.locator(".kids-program-block").count()).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewport.width,
    );
    await panel.getByRole("button", { name: "Cerrar propuesta" }).focus();
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.getByTestId("ori-ghost-block")).toHaveCount(0);
  });
}
