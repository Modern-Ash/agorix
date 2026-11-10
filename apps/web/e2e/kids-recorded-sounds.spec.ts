// agora-allowlist-file: end-to-end test of recording a sound into a project (issue #1309); fake microphone.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures.js";
import { clickCreateScene } from "./helpers.js";

test.use({
  hasTouch: true,
  serviceWorkers: "block",
  permissions: ["microphone"],
  launchOptions: {
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  },
});

async function openSounds(page: Page, adultSwitch: boolean) {
  await page.goto("/kids");
  await page.evaluate((on) => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    if (on) localStorage.setItem("agorix.kids.microphone.v1", "on");
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  }, adultSwitch);
  await page.addInitScript(() => {
    const w = window as unknown as { __asked: unknown[] };
    w.__asked = [];
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      w.__asked.push(constraints);
      return original(constraints);
    };
  });
  await page.reload();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await clickCreateScene(page);
  await page.getByRole("tab", { name: /Sonidos/ }).click();
}

test("without the adult switch there is no way to record, and the microphone is not asked for", async ({
  page,
}) => {
  await openSounds(page, false);
  await expect(page.getByTestId("record-sound")).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Mis grabaciones" })).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __asked: unknown[] }).__asked)).toEqual(
    [],
  );
});

test("a recording is trimmed, kept in the project, chosen for a block, and goes nowhere", async ({
  page,
}) => {
  const requests: { method: string; url: string; body: string }[] = [];
  page.on("request", (request) =>
    requests.push({
      method: request.method(),
      url: request.url(),
      body: request.postData() ?? "",
    }),
  );
  await openSounds(page, true);
  await page.getByTestId("record-sound").click();
  await expect(page.getByTestId("recording-status")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __asked: unknown[] }).__asked)).toEqual([
    { audio: true },
  ]);
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Parar" }).click();
  const editor = page.getByRole("region", { name: /Editar audio/ });
  await expect(editor).toBeVisible();
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await editor.getByRole("button", { name: "Guardar cambios" }).click();
  const mine = page.getByRole("group", { name: "Mis grabaciones" });
  await expect(mine.getByRole("button", { name: "Elegir y escuchar Mi sonido 1" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // It is saved inside the project, as a WAV the model accepts.
  const stored = await page.evaluate(() =>
    Object.keys(localStorage)
      .map((key) => localStorage.getItem(key) ?? "")
      .some((value) => value.includes("sound:recorded-1") && value.includes("data:audio/wav")),
  );
  expect(stored).toBe(true);
  await mine.getByRole("button", { name: "Usar Mi sonido 1" }).click();
  // The block really is in the program, so the saved project plays the recording.
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage).some((key) =>
          (localStorage.getItem(key) ?? "").includes('"soundId":"sound:recorded-1"'),
        ),
      ),
    )
    .toBe(true);
  // A recording a block plays cannot be deleted from under it.
  await mine.getByRole("button", { name: "Borrar Mi sonido 1" }).click();
  await expect(mine.getByRole("status")).toContainText("un bloque lo usa todavía");
  await expect(mine.getByRole("button", { name: "Elegir y escuchar Mi sonido 1" })).toBeVisible();
  const origin = new URL(page.url()).origin;
  expect(requests.filter((request) => !request.url.startsWith(origin))).toEqual([]);
  // The only request with a body is the scene's own (its setup choices); no sound is in any.
  expect(requests.filter((request) => /audio|wav|recorded/i.test(request.body))).toEqual([]);
});

test("a recording no block plays can be deleted", async ({ page }) => {
  await openSounds(page, true);
  await page.getByTestId("record-sound").click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Parar" }).click();
  await page
    .getByRole("region", { name: /Editar audio/ })
    .getByRole("button", { name: "Guardar cambios" })
    .click();
  const mine = page.getByRole("group", { name: "Mis grabaciones" });
  await mine.getByRole("button", { name: "Borrar Mi sonido 1" }).click();
  await expect(mine.getByRole("button", { name: "Elegir y escuchar Mi sonido 1" })).toHaveCount(0);
  await expect(mine).toContainText("Aún no grabaste nada");
});
