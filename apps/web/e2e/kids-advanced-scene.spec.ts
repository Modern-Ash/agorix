import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.use({ hasTouch: true });

const missions = ["kids.m1.straight", "kids.m2.corner", "kids.m3.zigzag"];

async function seed(page: import("@playwright/test").Page, locale: "es" | "en") {
  await page.goto("/kids");
  await page.evaluate(
    ({ ids, language }) => {
      localStorage.clear();
      localStorage.setItem("agorix.locale", language);
      localStorage.setItem(
        "agorix.kids.progress.v1",
        JSON.stringify({ onboarded: true, avatar: "🦊", stars: 3, done: {} }),
      );
      for (const id of ids) {
        localStorage.setItem(
          `agorix:kids.space.${id}`,
          JSON.stringify({
            schemaVersion: "agorix/program/v1",
            program: { schema: "agorix/program/v1", scripts: [] },
            metadata: {
              createdAt: "2026-10-22T00:00:00.000Z",
              updatedAt: "2026-10-22T00:00:00.000Z",
              missionProgress: 1,
              hintLevel: 0,
              locale: language,
            },
          }),
        );
      }
    },
    { ids: missions, language: locale },
  );
  await page.reload();
}

for (const locale of ["es", "en"] as const) {
  test(`advanced scene stays in Kids and survives reload (${locale})`, async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await seed(page, locale);
    const entry = page.getByRole("button", { name: /Nivel avanzado|Advanced level/ });
    await expect(entry).toBeVisible();
    await entry.click();
    await expect(page.locator("[data-screen='advanced']")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Creá una escena|Create a scene/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Amiga|Friend/ }).click();
    await page.getByRole("button", { name: /\+ Cambiar disfraz|\+ Switch costume/ }).click();
    await page.getByRole("button", { name: /\+ Tocar sonido|\+ Play sound/ }).click();
    await expect(page.getByLabel(/Código del programa|Program code/).last()).toContainText(
      "switch costume",
    );
    await expect(page.getByLabel(/Código del programa|Program code/).last()).toContainText(
      "play sound",
    );
    await page.getByRole("button", { name: locale === "es" ? "Jugar" : "Run" }).click();
    await expect(page.getByRole("status")).toContainText(/Escena lograda|Scene complete/);
    await page.reload();
    await page.getByRole("button", { name: /Nivel avanzado|Advanced level/ }).click();
    await expect(page.getByRole("status")).toContainText(/Escena lograda|Scene complete/);
    const axe = await new AxeBuilder({ page }).analyze();
    expect(
      axe.violations.filter((violation) =>
        ["critical", "serious"].includes(violation.impact ?? ""),
      ),
    ).toEqual([]);
  });
}

test("advanced entry stays hidden before all three authored missions", async ({ page }) => {
  await page.goto("/kids");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🦊", stars: 3, done: {} }),
    );
  });
  await page.reload();
  await expect(page.getByRole("button", { name: /Nivel avanzado/ })).toHaveCount(0);
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1180, height: 820 },
]) {
  test(`advanced controls fit ${viewport.width}x${viewport.height} and undo works`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await seed(page, "es");
    await page.getByRole("button", { name: /Nivel avanzado/ }).click();
    await page.getByRole("button", { name: /\+ Cambiar disfraz/ }).click();
    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect(page.getByLabel("Código del programa").last()).not.toContainText("switch costume");
    await page.getByRole("button", { name: "Rehacer" }).click();
    await expect(page.getByLabel("Código del programa").last()).toContainText("switch costume");
    await page.getByRole("button", { name: "Tocar sonido" }).focus();
    await page.keyboard.press("Enter");
    const controls = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      return [...document.querySelectorAll<HTMLElement>(".kids-root button")]
        .filter((element) => {
          const box = element.getBoundingClientRect();
          return box.width > 0 && box.height > 0;
        })
        .map((element) => ({
          label: element.getAttribute("aria-label") ?? element.textContent ?? "",
          box: element.getBoundingClientRect().toJSON(),
        }))
        .filter(
          ({ box }) => box.width < 44 || box.height < 44 || box.left < -1 || box.right > width + 1,
        )
        .map(({ label }) => label);
    });
    expect(controls).toEqual([]);
  });
}
