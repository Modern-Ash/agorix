import { expect, test, type Page } from "@playwright/test";

test.use({ hasTouch: true, serviceWorkers: "block" });

async function start(page: Page, flags: readonly string[]) {
  await page.goto("/kids");
  await page.evaluate((enabled) => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem("agorix.kids.flags.v1", JSON.stringify(enabled));
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  }, flags);
  await page.reload();
}

test("named sound is selected, saved and replayed from the canonical program", async ({ page }) => {
  await start(page, ["soundLibrary"]);
  await page.getByRole("button", { name: "Misión 1" }).click();
  await page.getByRole("button", { name: "+ sonar", exact: true }).click();
  const choice = page.getByRole("combobox", { name: "sonar 1" });
  await choice.selectOption("kids:win");
  await expect(choice).toHaveValue("kids:win");
  await page.reload();
  await page.getByRole("button", { name: "Misión 1" }).click();
  await expect(page.getByRole("combobox", { name: "sonar 1" })).toHaveValue("kids:win");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "No sé" }).click();
  await expect(
    page.locator(".kids-program-block.kids-block-sound .kids-block-mark"),
  ).toHaveAttribute("aria-label", /1/);
});

test("adult audio stays in IndexedDB and a bad upload is rejected", async ({ page }) => {
  await start(page, ["soundLibrary", "customAudio"]);
  await page.getByRole("button", { name: "Adultos" }).click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "2", exact: true }).click();
  await page.getByRole("button", { name: "Comprobar" }).click();
  const panel = page.getByRole("region", { name: "Sonidos propios" });
  const input = panel.getByLabel("Elegir audio para 🐸");
  await input.setInputFiles({
    name: "fake.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from("not a wave"),
  });
  await expect(panel.getByRole("status")).toContainText("MP3, WAV u Ogg válido");
  const samples = Buffer.alloc(8000 * 2);
  const wav = Buffer.alloc(44 + samples.length);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples.length, 40);
  samples.copy(wav, 44);
  await input.setInputFiles({ name: "frog.wav", mimeType: "audio/wav", buffer: wav });
  await expect(panel.getByRole("status")).toContainText("guardado");
  expect(
    await page.evaluate(() => Object.keys(localStorage).some((key) => key.includes("audio"))),
  ).toBe(false);
  expect(
    await page.evaluate(() =>
      indexedDB.databases().then((dbs) => dbs.some((db) => db.name === "agorix.kids.audio.v1")),
    ),
  ).toBe(true);
});
