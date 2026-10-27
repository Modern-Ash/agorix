// agora-allowlist-file: end-to-end test of the one supervised voice recorder (issue #622); fake microphone.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { passAdultGate, reloadToMap } from "./helpers.js";

// Issue #622: supervised voice recording. A fake microphone stands in for a real one.
test.use({
  hasTouch: true,
  serviceWorkers: "block",
  permissions: ["microphone"],
  launchOptions: {
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  },
});

/** How many sounds are stored on the device (the database exists as soon as the panel looks). */
async function storedSounds(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open("agorix.kids.audio.v1", 1);
        open.onupgradeneeded = () => open.result.createObjectStore("actorAudio");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const count = open.result.transaction("actorAudio").objectStore("actorAudio").count();
          count.onsuccess = () => {
            open.result.close();
            resolve(count.result);
          };
        };
      }),
  );
}

async function adultAudioPanel(page: Page) {
  await page.goto("/kids");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem("agorix.kids.flags.v1", JSON.stringify(["soundLibrary", "customAudio"]));
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  });
  // Count what the page does with the microphone, and every request it makes.
  await page.addInitScript(() => {
    const tracks: MediaStreamTrack[] = [];
    (window as unknown as { __tracks: MediaStreamTrack[] }).__tracks = tracks;
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      (window as unknown as { __asked: unknown }).__asked = constraints;
      const stream = await original(constraints);
      tracks.push(...stream.getTracks());
      return stream;
    };
  });
  await reloadToMap(page);
  await page.getByRole("button", { name: "Adultos" }).click();
  await passAdultGate(page);
  return page.getByRole("region", { name: "Sonidos propios" });
}

test("nothing can record until an adult allows it, and turning it off removes the buttons", async ({
  page,
}) => {
  const panel = await adultAudioPanel(page);
  await expect(panel.getByRole("button", { name: /Grabar a/ })).toHaveCount(0);
  const allow = panel.getByLabel("Permitir grabar con el micrófono de este dispositivo");
  await expect(allow).not.toBeChecked();
  expect(
    await page.evaluate(() => (window as unknown as { __asked?: unknown }).__asked),
  ).toBeUndefined();
  await allow.check();
  await expect(panel.getByRole("button", { name: "Grabar a 🐸" })).toBeVisible();
  await allow.uncheck();
  await expect(panel.getByRole("button", { name: /Grabar a/ })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("agorix.kids.microphone.v1"))).toBeNull();
});

test("an adult records, hears and trims it, saves it on the device, and the microphone is let go", async ({
  page,
}) => {
  const requests: { method: string; url: string }[] = [];
  page.on("request", (request) => requests.push({ method: request.method(), url: request.url() }));
  const panel = await adultAudioPanel(page);
  await panel.getByLabel("Permitir grabar con el micrófono de este dispositivo").check();
  await panel.getByRole("button", { name: "Grabar a 🐸" }).click();
  await expect(panel.getByText(/Grabando: \d s/)).toBeVisible();
  // Only audio was asked for.
  expect(await page.evaluate(() => (window as unknown as { __asked: unknown }).__asked)).toEqual({
    audio: true,
  });
  await page.waitForTimeout(1200);
  await panel.getByRole("button", { name: "Parar" }).click();
  const editor = page.getByRole("region", { name: "Editar audio de 🐸" });
  await expect(editor).toBeVisible();
  const text = await editor.getByText(/Duración: [\d.]+ s/).textContent();
  const seconds = Number(/([\d.]+) s/.exec(text ?? "")![1]);
  expect(seconds).toBeGreaterThan(0.5);
  expect(seconds).toBeLessThanOrEqual(5);
  // The microphone is released as soon as the recording ends.
  expect(
    await page.evaluate(() =>
      (window as unknown as { __tracks: MediaStreamTrack[] }).__tracks.map(
        (track) => track.readyState,
      ),
    ),
  ).toEqual(["ended"]);
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await editor.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(panel.getByRole("status").last()).toContainText("guardado");
  expect(
    await page.evaluate(() =>
      indexedDB.databases().then((dbs) => dbs.some((db) => db.name === "agorix.kids.audio.v1")),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() => Object.keys(localStorage).some((key) => key.includes("audio"))),
  ).toBe(false);
  // Nothing was sent anywhere: every request stayed on this origin and none carried a body.
  const origin = new URL(page.url()).origin;
  expect(requests.filter((request) => !request.url.startsWith(origin))).toEqual([]);
  expect(
    requests.filter((request) => request.method !== "GET" && request.method !== "HEAD"),
  ).toEqual([]);
});

test("leaving the panel mid-recording lets go of the microphone and saves nothing", async ({
  page,
}) => {
  const panel = await adultAudioPanel(page);
  await panel.getByLabel("Permitir grabar con el micrófono de este dispositivo").check();
  await panel.getByRole("button", { name: "Grabar a 🐸" }).click();
  await expect(panel.getByText(/Grabando/)).toBeVisible();
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { __tracks: MediaStreamTrack[] }).__tracks.map(
          (track) => track.readyState,
        ),
      ),
    )
    .toEqual(["ended"]);
  expect(await storedSounds(page)).toBe(0);
});
