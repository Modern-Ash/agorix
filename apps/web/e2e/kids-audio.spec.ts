import { expect, test, type Page } from "./fixtures.js";
import { soundParameters } from "../src/kids/kidsSoundLibrary.js";
import { clickCreateScene } from "./helpers.js";

// Issue #1220: the runtime trace is the proof of a sound ("N bloques ejecutados"), but a child
// also has to *hear* it. Headless browsers have no speaker, so these specs put a spy on Web Audio
// and check that Play really asks for the chosen sound, that "Detener sonidos" lets go of it, and
// that a device without audio never stops the run.
test.use({ serviceWorkers: "block" });

type Spy = {
  readonly oscillators: readonly { type: string; startHz?: number; started: boolean }[];
  readonly closed: number;
};

async function installSpy(page: Page) {
  await page.addInitScript(() => {
    const Real =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Real) return;
    const log = { oscillators: [] as unknown[], closed: 0 };
    (window as unknown as { __audioSpy: unknown }).__audioSpy = log;
    const create = Real.prototype.createOscillator;
    Real.prototype.createOscillator = function () {
      const oscillator = create.call(this);
      const record: { type: string; startHz?: number; started: boolean } = {
        type: oscillator.type,
        started: false,
      };
      const setValueAtTime = oscillator.frequency.setValueAtTime.bind(oscillator.frequency);
      oscillator.frequency.setValueAtTime = (value: number, time: number) => {
        record.startHz ??= value;
        return setValueAtTime(value, time);
      };
      const start = oscillator.start.bind(oscillator);
      oscillator.start = (when?: number) => {
        record.started = true;
        record.type = oscillator.type;
        return start(when);
      };
      log.oscillators.push(record);
      return oscillator;
    };
    const close = Real.prototype.close;
    Real.prototype.close = function () {
      log.closed += 1;
      return close.call(this);
    };
  });
}

const spy = (page: Page) =>
  page.evaluate(() => (window as unknown as { __audioSpy: Spy }).__audioSpy);

async function freeScene(page: Page) {
  await page.setViewportSize({ width: 1280, height: 900 });
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

async function addBell(page: Page) {
  const palette = page.locator(".kids-studio-palette");
  await palette
    .locator(".kids-palette-tool-sound")
    .filter({ has: page.getByRole("button", { name: "+ Sonar", exact: true }) })
    .getByRole("button", { name: "Elegir y escuchar Campana" })
    .click();
  await page.getByRole("button", { name: "+ Sonar", exact: true }).click();
  await expect(page.locator(".kids-program-block").last()).toContainText("Sonar: Campana");
}

test("Play asks the browser for the chosen sound, and Stop sounds lets go of it", async ({
  page,
}) => {
  await installSpy(page);
  await freeScene(page);
  await addBell(page);

  // Choosing it plays a preview; start counting from a clean slate.
  await page.evaluate(() => {
    const log = (window as unknown as { __audioSpy: { oscillators: unknown[]; closed: number } })
      .__audioSpy;
    log.oscillators.length = 0;
    log.closed = 0;
  });
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("1 bloque ejecutado")).toBeVisible();
  await expect.poll(async () => (await spy(page)).oscillators.length).toBeGreaterThan(0);
  const bell = soundParameters("kids:bell");
  const played = (await spy(page)).oscillators.find((item) => item.started);
  expect(played?.type).toBe(bell.wave);
  expect(played?.startHz).toBe(bell.startHz);

  // "Detener sonidos" releases every audio context the sound opened.
  await page.getByRole("button", { name: "+ Detener sonidos", exact: true }).click();
  const closedBefore = (await spy(page)).closed;
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect.poll(async () => (await spy(page)).closed).toBeGreaterThan(closedBefore);
});

test("a device without audio never stops the run", async ({ page }) => {
  const crashes: string[] = [];
  page.on("pageerror", (error) => crashes.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "AudioContext", { value: undefined, configurable: true });
    Object.defineProperty(window, "webkitAudioContext", { value: undefined, configurable: true });
  });
  await freeScene(page);
  await addBell(page);
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("2 bloques ejecutados")).toBeVisible();
  // Safari reports a lazy stylesheet it cancels as "Unable to preload CSS" (#1226); that is about loading, not about audio, so it is not counted here.
  expect(crashes.filter((message) => !/^Unable to preload CSS/.test(message))).toEqual([]);
});
