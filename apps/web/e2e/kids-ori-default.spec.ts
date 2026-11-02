import { expect, test } from "./fixtures.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

test("Ori accompanies a new learner through onboarding, map, creation and editor", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/kids");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
  });
  await page.reload();

  await expect(page.getByRole("button", { name: "Hablar con Ori" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hablar con Ori" })).toHaveAttribute(
    "data-ori-state",
    "idle",
  );
  await page.getByRole("button", { name: "Hablar con Ori" }).click();
  await expect(page.getByRole("button", { name: "Hablar con Ori" })).toHaveAttribute(
    "data-ori-state",
    "listening",
  );
  await expect(page.getByRole("dialog", { name: "Ori te acompaña" })).toContainText(
    "Elegí cómo querés explorar",
  );
  await page.getByRole("button", { name: "Cerrar" }).click();

  await page.getByRole("button", { name: "Seguir" }).click();
  await page.getByRole("button", { name: "Seguir" }).click();
  await page.getByRole("button", { name: "¡Empezar!" }).click();
  await expect(page.getByRole("button", { name: "Hablar con Ori" })).toBeVisible();

  await page.getByRole("button", { name: /Crear/ }).first().click();
  await expect(page.getByRole("button", { name: "Hablar con Ori" })).toBeVisible();
  await page.getByRole("button", { name: "Hablar con Ori" }).click();
  await expect(page.getByRole("dialog", { name: "Ori te acompaña" })).toContainText(
    "¿Qué te gustaría que pase ahí?",
  );
  await page.getByRole("button", { name: "Cerrar" }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();

  // Ori stays present in free creation whether the local provider has an idea or not.
  const ori = page.getByRole("button", { name: /(Abrir (ayuda|propuesta)|Mostrar ayuda) de Ori/ });
  await expect(ori).toBeVisible();
});

test("Ori pauses offscreen and respects reduced motion", async ({ page }) => {
  await page.goto("/kids");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
  });
  await page.reload();
  const ori = page.getByRole("button", { name: "Hablar con Ori" });
  await expect(ori).toHaveAttribute("data-ori-state", "idle");
  await expect
    .poll(() =>
      ori
        .locator("span")
        .first()
        .evaluate((node) => getComputedStyle(node).animationName),
    )
    .toBe("kids-ori-breathe");
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(ori).toHaveAttribute("data-ori-paused", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() =>
      ori
        .locator("span")
        .first()
        .evaluate((node) => getComputedStyle(node).animationName),
    )
    .toBe("none");
});

test("Ori remains visible in an advanced stage without changing the program", async ({ page }) => {
  await page.goto("/kids");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🦊", stars: 3, done: {} }),
    );
    localStorage.setItem(
      "agorix.kids.missionScenes.v1",
      JSON.stringify({
        "kids.space.kids.m1.straight": "studio-1",
        "kids.space.kids.m2.corner": "studio-2",
        "kids.space.kids.m3.zigzag": "studio-3",
      }),
    );
    for (const id of ["kids.m1.straight", "kids.m2.corner", "kids.m3.zigzag"])
      localStorage.setItem(
        `agorix:studio-${["kids.m1.straight", "kids.m2.corner", "kids.m3.zigzag"].indexOf(id) + 1}`,
        JSON.stringify({
          schemaVersion: "agorix/program/v1",
          program: { schema: "agorix/program/v1", scripts: [] },
          metadata: {
            createdAt: "2026-10-22T00:00:00.000Z",
            updatedAt: "2026-10-22T00:00:00.000Z",
            missionProgress: 1,
            hintLevel: 0,
            locale: "es",
          },
        }),
      );
  });
  await page.reload();
  await page.getByRole("button", { name: /Nivel avanzado/ }).click();
  const before = await page.getByLabel("Código del programa").last().textContent();
  await page.getByRole("button", { name: "Hablar con Ori" }).click();
  await expect(page.getByRole("dialog", { name: "Ori te acompaña" })).toContainText(
    "Cada personaje tiene sus propios bloques",
  );
  await page.getByRole("button", { name: "Cerrar" }).click();
  expect(await page.getByLabel("Código del programa").last().textContent()).toBe(before);
  await expect(page.getByRole("button", { name: "Pedirle una idea a Ori" })).toBeVisible();
});
