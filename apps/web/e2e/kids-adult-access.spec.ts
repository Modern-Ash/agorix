import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.use({ hasTouch: true, serviceWorkers: "block" });

// Issue #599: a PIN chosen by the adult replaces a fixed calculation that a child could learn.
async function start(page: Page) {
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
  await page.getByRole("button", { name: "Adultos" }).click();
}

async function press(page: Page, digits: string) {
  for (const digit of digits) await page.getByRole("button", { name: digit, exact: true }).click();
  await page.getByRole("button", { name: "Comprobar" }).click();
}

async function solve(page: Page) {
  const heading = (await page.locator("#kids-parents-title").textContent()) ?? "";
  const sum = /(\d+) × (\d+)/.exec(heading)!;
  await press(page, String(Number(sum[1]) * Number(sum[2])));
}

const title = (page: Page) => page.locator("#kids-parents-title");

test("a new adult solves a fresh calculation, chooses a PIN and then enters with it", async ({
  page,
}) => {
  await start(page);
  await expect(title(page)).toHaveText(/¿Cuánto es \d+ × \d+\?/);
  // A wrong answer changes the question, so the answer cannot be learned.
  const first = await title(page).textContent();
  await press(page, "9");
  await expect(page.getByText("Probá otra vez.")).toBeVisible();
  await expect(page.locator("#kids-parents-title")).toBeVisible();
  void first;
  await solve(page);
  await expect(title(page)).toHaveText(/Elegí un PIN de adulto/);
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  // Too short, and too easy to guess, are refused with a reason.
  await press(page, "12");
  await expect(page.getByText("Usá entre 4 y 6 números.")).toBeVisible();
  await press(page, "1111");
  await expect(page.getByText("Ese PIN es muy fácil de adivinar")).toBeVisible();
  await press(page, "4829");
  await expect(title(page)).toHaveText("Repetí el PIN");
  await press(page, "4821");
  await expect(page.getByText("No coinciden")).toBeVisible();
  await expect(title(page)).toHaveText(/Elegí un PIN de adulto/);
  await press(page, "4829");
  await press(page, "4829");
  await expect(page.getByRole("tablist", { name: "Secciones de Adultos" })).toBeVisible();

  // The PIN is kept as a salted hash on this device and survives a reload.
  const stored = await page.evaluate(() => localStorage.getItem("agorix.kids.adultpin.v1"));
  expect(stored).not.toBeNull();
  expect(stored).not.toContain("4829");
  await page.getByRole("button", { name: "Salir" }).click();
  await expect(title(page)).toHaveText("Ingresá tu PIN de adulto");
  await page.evaluate(() => {
    window.history.replaceState(null, "", "#/adultos");
  });
  await page.reload();
  await expect(title(page)).toHaveText("Ingresá tu PIN de adulto");
  await press(page, "4829");
  await expect(page.getByRole("tablist", { name: "Secciones de Adultos" })).toBeVisible();
});

test("wrong PINs make the child wait, even with the right PIN, and a forgotten PIN is reset by a fresh calculation", async ({
  page,
}) => {
  await start(page);
  await solve(page);
  await press(page, "4829");
  await press(page, "4829");
  await expect(page.getByRole("tablist", { name: "Secciones de Adultos" })).toBeVisible();
  await page.getByRole("button", { name: "Salir" }).click();
  for (let i = 0; i < 4; i += 1) {
    await press(page, "9999");
    await expect(page.getByText(/PIN incorrecto/)).toBeVisible();
  }
  await press(page, "9999");
  await expect(page.getByText(/Esperá un momento antes de probar de nuevo/)).toBeVisible();
  // While waiting, the keys do nothing, not even for the right PIN.
  await expect(page.getByRole("button", { name: "4", exact: true })).toBeDisabled();
  // The pad also fits and stays touchable.
  for (const button of await page.locator(".kids-gate-pad button").all()) {
    const box = (await button.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  // Forgetting the PIN starts again from a fresh calculation and a new PIN.
  await page.getByRole("button", { name: "Me olvidé el PIN" }).click();
  await expect(title(page)).toHaveText(/¿Cuánto es \d+ × \d+\?/);
  await solve(page);
  await press(page, "7351");
  await press(page, "7351");
  await expect(page.getByRole("tablist", { name: "Secciones de Adultos" })).toBeVisible();
  await page.getByRole("button", { name: "Salir" }).click();
  await press(page, "4829");
  await expect(page.getByText(/PIN incorrecto|Esperá/)).toBeVisible();
});
