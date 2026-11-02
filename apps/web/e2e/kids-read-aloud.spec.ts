import { expect, test, type Page } from "./fixtures.js";

test.use({ serviceWorkers: "block", hasTouch: true });

async function speechLog(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __speechLog: { spoken: { text: string; lang: string }[]; cancels: number };
        }
      ).__speechLog,
  );
}

async function stubSpeech(page: Page) {
  await page.addInitScript(() => {
    const log = { spoken: [] as { text: string; lang: string }[], cancels: 0 };
    (window as unknown as { __speechLog: typeof log }).__speechLog = log;
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: class {
        text: string;
        lang = "";
        rate = 1;
        constructor(text: string) {
          this.text = text;
        }
      },
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel: () => log.cancels++,
        speak: (utterance: { text: string; lang: string }) =>
          log.spoken.push({ text: utterance.text, lang: utterance.lang }),
      },
    });
  });
}

async function start(page: Page, readAloud: boolean) {
  await page.goto("/kids");
  await page.evaluate((enabled) => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
    localStorage.setItem(
      "agorix.kids.adults.v1",
      JSON.stringify({
        oriSuggestions: true,
        readAloud: enabled,
        dailyLimitMinutes: 30,
        ageBand: "6-8",
      }),
    );
  }, readAloud);
  await page.reload();
}

test("listen reads visible Kids instructions and results, never a project identifier", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stubSpeech(page);
  await start(page, true);
  const listen = page.getByRole("button", { name: "Escuchar", exact: true });
  await listen.click();
  expect((await speechLog(page)).spoken.at(-1)).toMatchObject({ lang: "es-AR" });

  await page.getByRole("button", { name: "Crear", exact: true }).click();
  const beforeCreate = (await speechLog(page)).cancels;
  await listen.click();
  const createNote = (await page.locator(".kids-create .kids-note").first().textContent())?.trim();
  expect((await speechLog(page)).spoken.at(-1)?.text).toBe(createNote);
  expect((await speechLog(page)).cancels).toBe(beforeCreate + 1);

  await page.getByRole("button", { name: "Crear escena" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto("/kids#/proyectos");
  await page.reload();
  await listen.click();
  const projectsSpeech = (await speechLog(page)).spoken.at(-1)?.text ?? "";
  expect(projectsSpeech).toContain("Mis proyectos");
  expect(projectsSpeech).not.toContain("studio-");
  await expect(page.locator(".kids-project-card").first()).toBeVisible();

  await page.getByRole("button", { name: "Mapa" }).click();
  await page.getByRole("button", { name: "Misión 1" }).click();
  const goal = (await page.locator(".kids-mission-studio-intro p").first().textContent())?.trim();
  await page
    .locator(".kids-mission-studio-intro")
    .getByRole("button", { name: "Escuchar" })
    .click();
  expect((await speechLog(page)).spoken.at(-1)?.text).toBe(goal);
});

test("repeated taps replace speech and navigation or language changes stop it", async ({
  page,
}) => {
  await stubSpeech(page);
  await page.goto("/kids");
  await page.evaluate(() => localStorage.setItem("agorix.locale", "es"));
  await page.reload();
  await page.getByRole("button", { name: "Escuchar" }).click();
  await page.getByRole("button", { name: "Escuchar" }).click();
  expect((await speechLog(page)).spoken).toHaveLength(2);
  expect((await speechLog(page)).cancels).toBeGreaterThanOrEqual(2);
  const beforeLanguage = (await speechLog(page)).cancels;
  await page.getByRole("button", { name: "English" }).click();
  expect((await speechLog(page)).cancels).toBeGreaterThan(beforeLanguage);
  await page.getByRole("button", { name: "Listen" }).click();
  expect((await speechLog(page)).spoken.at(-1)?.lang).toBe("en-US");
  const beforeStep = (await speechLog(page)).cancels;
  await page.getByRole("button", { name: "Next" }).click();
  expect((await speechLog(page)).cancels).toBeGreaterThan(beforeStep);
});

test("adult switch hides listen controls on main Kids screens", async ({ page }) => {
  await stubSpeech(page);
  await start(page, false);
  const listen = page.getByRole("button", { name: "Escuchar", exact: true });
  await expect(listen).toHaveCount(0);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await expect(listen).toHaveCount(0);
  await page.getByRole("button", { name: "Crear escena" }).click();
  await expect(listen).toHaveCount(0);
  await page.goto("/kids#/proyectos");
  await page.reload();
  await expect(listen).toHaveCount(0);
  expect((await speechLog(page)).spoken).toEqual([]);
});

test("missing speech synthesis leaves visible text and navigation usable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: undefined });
  });
  await start(page, true);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Escuchar" }).click();
  await expect(page.locator(".kids-create .kids-note").first()).toBeVisible();
  await page.getByRole("button", { name: "Mapa" }).click();
  await expect(page.getByRole("heading", { name: "Mapa" })).toBeVisible();
});

test("advanced stages read only their visible mission instruction or result", async ({ page }) => {
  await stubSpeech(page);
  await start(page, true);
  await page.evaluate(() => {
    localStorage.setItem(
      "agorix.kids.missionScenes.v1",
      JSON.stringify({
        "kids.space.kids.m1.straight": "studio-1",
        "kids.space.kids.m2.corner": "studio-2",
        "kids.space.kids.m3.zigzag": "studio-3",
      }),
    );
    for (const id of ["kids.m1.straight", "kids.m2.corner", "kids.m3.zigzag"]) {
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
    }
  });
  await page.reload();
  const listen = page.getByRole("button", { name: "Escuchar", exact: true });
  await page.getByRole("button", { name: /Nivel avanzado/ }).click();
  await listen.click();
  expect((await speechLog(page)).spoken.at(-1)?.text).toBe(
    (await page.locator(".kids-editor-goal").textContent())?.trim(),
  );
  await page.getByRole("button", { name: /\+ Cambiar disfraz/ }).click();
  await page.getByRole("button", { name: /\+ Tocar sonido/ }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await listen.click();
  expect((await speechLog(page)).spoken.at(-1)?.text).toContain("Escena lograda");
  await page.getByRole("button", { name: "Volver al mapa" }).click();

  await page.getByRole("button", { name: /Etapa 2/ }).click();
  await listen.click();
  expect((await speechLog(page)).spoken.at(-1)?.text).toBe(
    (await page.locator(".kids-editor-goal").textContent())?.trim(),
  );
  await page.getByRole("button", { name: /\+ Cambiar disfraz/ }).click();
  await page.getByRole("button", { name: "Tocar a Ori" }).click();
  await page.getByRole("button", { name: "Volver al mapa" }).click();

  await page.getByRole("button", { name: /Etapa 3/ }).click();
  await listen.click();
  expect((await speechLog(page)).spoken.at(-1)?.text).toBe(
    (await page.locator(".kids-editor-goal").textContent())?.trim(),
  );
});
