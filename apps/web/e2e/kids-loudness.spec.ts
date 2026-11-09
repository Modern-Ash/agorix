// agora-allowlist-file: end-to-end test of the one microphone level meter (issue #1304); fake microphone.
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

async function openScene(page: Page, levelSwitch: boolean) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/kids");
  await page.evaluate((on) => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    if (on) localStorage.setItem("agorix.kids.microphoneLevel.v1", "on");
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  }, levelSwitch);
  await page.addInitScript(() => {
    const tracks: MediaStreamTrack[] = [];
    const w = window as unknown as { __tracks: MediaStreamTrack[]; __asked: unknown[] };
    w.__tracks = tracks;
    w.__asked = [];
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      w.__asked.push(constraints);
      const stream = await original(constraints);
      tracks.push(...stream.getTracks());
      return stream;
    };
  });
  await page.reload();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await clickCreateScene(page);
}

async function buildLoudProgram(page: Page) {
  await page.getByLabel("Primera condición").selectOption("loud");
  await page.getByLabel("Unir con").selectOption("none");
  await page.getByTestId("compound-if").click();
  await page.getByRole("combobox", { name: "Esperar" }).selectOption("2");
  await page.getByRole("button", { name: "+ Esperar", exact: true }).click();
}

test("without the adult switch the microphone is never asked for and loudness is not offered", async ({
  page,
}) => {
  await openScene(page, false);
  await expect(page.getByLabel("Primera condición").locator('option[value="loud"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as unknown as { __asked: unknown[] }).__asked)).toEqual(
    [],
  );
  await expect(page.getByTestId("studio-listening")).toHaveCount(0);
});

test("with the switch, a program that reads loudness shows it is listening and lets the microphone go", async ({
  page,
}) => {
  await openScene(page, true);
  await buildLoudProgram(page);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByTestId("studio-listening")).toBeVisible();
  // Only audio, never video.
  expect(await page.evaluate(() => (window as unknown as { __asked: unknown[] }).__asked)).toEqual([
    { audio: true },
  ]);
  await expect(page.getByTestId("studio-listening")).toHaveCount(0, { timeout: 15_000 });
  expect(
    await page.evaluate(() =>
      (window as unknown as { __tracks: MediaStreamTrack[] }).__tracks.map(
        (track) => track.readyState,
      ),
    ),
  ).toEqual(["ended"]);
});

test("a character starts when the microphone gets loud, and only with the switch", async ({
  page,
}) => {
  await openScene(page, true);
  await page.getByLabel("Cuando").selectOption("onLoudnessOver");
  await page.getByTestId("event-level").selectOption("10");
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await expect(page.locator(".kids-start-block")).toContainText("Cuando el volumen pasa de 10");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByTestId("studio-listening")).toBeVisible();
  // The fake microphone beeps; the hat starts the script when it does.
  await expect(page.getByText("1 bloque ejecutado")).toBeVisible({ timeout: 20_000 });
  await page.locator(".kids-stop-button").click();
  await expect(page.getByTestId("studio-listening")).toHaveCount(0);
});

test("without the switch the loudness event is not offered", async ({ page }) => {
  await openScene(page, false);
  await expect(page.getByLabel("Cuando").locator('option[value="onLoudnessOver"]')).toHaveCount(0);
});
