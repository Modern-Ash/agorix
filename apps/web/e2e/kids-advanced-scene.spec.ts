import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures.js";
import { reloadToMap } from "./helpers.js";

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
  await reloadToMap(page);
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
    await reloadToMap(page);
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
  await reloadToMap(page);
  await expect(page.getByRole("button", { name: /Nivel avanzado/ })).toHaveCount(0);
});

test("Ori's offline stage idea is reviewable, changeable and one undo step", async ({ page }) => {
  await seed(page, "es");
  await page.getByRole("button", { name: /Nivel avanzado/ }).click();
  await page.getByRole("button", { name: "Pedirle una idea a Ori" }).click();
  const review = page.getByLabel("Ori propone agregar");
  await expect(review).toContainText("Cambiar disfraz");
  await expect(page.getByLabel("Código del programa").last()).not.toContainText("switch costume");
  await review.getByRole("button", { name: "Cambiar bloque" }).click();
  await expect(review).toContainText("Tocar sonido");
  await review.getByRole("button", { name: "Agregar bloque" }).click();
  await expect(page.getByLabel("Código del programa").last()).toContainText("play sound");
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByLabel("Código del programa").last()).not.toContainText("play sound");
  await page.getByRole("button", { name: "Pedirle una idea a Ori" }).click();
  await review.getByRole("button", { name: "No usar" }).click();
  await expect(review).toHaveCount(0);
  await expect(page.getByLabel("Código del programa").last()).not.toContainText("switch costume");
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

test("curated actors keep independent move scripts, selection and portable save", async ({
  page,
}) => {
  await seed(page, "es");
  await page.getByRole("button", { name: /Nivel avanzado/ }).click();
  await page.getByRole("button", { name: "+ Robot" }).click();
  await expect(page.getByRole("button", { name: /Robot/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "+ Mover 1" }).click();
  await page.getByRole("button", { name: "+ Rana" }).click();
  await page.getByRole("button", { name: "+ Mover 1" }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByRole("button", { name: /Robot.*Avanzó 1/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Rana.*Avanzó 1/ })).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exportar .agorix" }).click(),
  ]);
  const path = await download.path();
  expect(path).not.toBeNull();
  await page.getByRole("button", { name: "Deshacer" }).click();
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByRole("button", { name: "+ Rana" })).toBeVisible();
  await page.getByLabel("Importar .agorix").setInputFiles(path!);
  await expect(page.getByRole("button", { name: /Rana/ })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: /Rana/ }).click();
  await reloadToMap(page);
  await page.getByRole("button", { name: /Nivel avanzado/ }).click();
  await expect(page.getByRole("button", { name: /Rana/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByRole("button", { name: /Robot.*Avanzó 1/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Rana.*Avanzó 1/ })).toBeVisible();
});

test("the third curated look appears at the costume step", async ({ page }) => {
  await seed(page, "es");
  await page.getByRole("button", { name: /Nivel avanzado/ }).click();
  await page.getByRole("button", { name: "+ Robot" }).click();
  await page.getByRole("button", { name: "+ Cambiar disfraz" }).click();
  await page
    .getByRole("combobox", { name: "Cambiar disfraz 1" })
    .selectOption("asset:costume.explorer");
  await page.getByRole("button", { name: "Jugar" }).click();
  await expect(page.getByRole("button", { name: /Robot.*Explorador/ })).toBeVisible();
  await page.getByRole("button", { name: "Inicio" }).click();
  await expect(page.getByRole("button", { name: /Robot.*Explorador/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Paso" }).click();
  await expect(page.getByRole("button", { name: /Robot.*Explorador/ })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter((item) => ["critical", "serious"].includes(item.impact ?? "")),
  ).toEqual([]);
});

test("English curated chooser works with keyboard", async ({ page }) => {
  await seed(page, "en");
  await page.getByRole("button", { name: /Advanced level/ }).click();
  const add = page.getByRole("button", { name: "+ Frog" });
  await add.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /Frog/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Blocks for Frog" })).toBeVisible();
});
