import { expect, test, type Page } from "./fixtures.js";
import { clickCreateScene } from "./helpers.js";

async function openScene(page: Page) {
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
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await clickCreateScene(page);
}

test.use({ hasTouch: true, serviceWorkers: "block" });

test("Play shows the run live and Stop ends it where it is", async ({ page }) => {
  await openScene(page);
  for (let i = 0; i < 6; i++)
    await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  const step = page.getByRole("button", { name: "Paso", exact: true });
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  // While playing, the run is stepping through frames: Step is enabled before the end.
  await expect(step).toBeEnabled();
  // Stop clears the run immediately.
  await page.locator(".kids-stop-button").click();
  await expect(step).toBeDisabled();
});

test("moves slide and turns rotate on stage while Play runs", async ({ page }) => {
  await openScene(page);
  for (let i = 0; i < 6; i++)
    await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
  const actor = page.locator(".kids-studio-stage-actor").first();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect
    .poll(() => actor.evaluate((node) => (node as HTMLElement).style.transition))
    .toContain("left");
  // The turn ends the script: the character is left rotated 90 degrees.
  await expect
    .poll(() =>
      actor
        .locator(".kids-studio-stage-costume")
        .evaluate((node) => (node as HTMLElement).style.transform),
    )
    .toContain("rotate(90deg)");
});

test("Replay watches the last run again and ends where it ended", async ({ page }) => {
  await openScene(page);
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  const actor = page.locator(".kids-studio-stage-actor").first();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  const replay = page.locator(".kids-replay-button");
  await expect(replay).toBeEnabled();
  const left = await actor.evaluate((node) => (node as HTMLElement).style.left);
  expect(left).not.toBe("8%");
  await replay.click();
  await expect(replay).toBeEnabled();
  await expect.poll(() => actor.evaluate((node) => (node as HTMLElement).style.left)).toBe(left);
});

test("a saved replay opens on the same program and is refused on another (#1577)", async ({
  page,
}) => {
  await openScene(page);
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  const actor = page.locator(".kids-studio-stage-actor").first();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.locator(".kids-replay-button")).toBeEnabled();
  const left = await actor.evaluate((node) => (node as HTMLElement).style.left);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Guardar repetición" }).click(),
  ]);
  const path = await download.path();
  const fs = await import("node:fs");
  const file = fs.readFileSync(path!);
  const upload = { name: "replay.json", mimeType: "application/json", buffer: file };

  // Another program, run once: the saved file belongs to the first one and is refused.
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.locator(".kids-replay-button")).toBeEnabled();
  const note = page.getByRole("status").filter({ hasText: /repetición|replay/i });
  await page.getByLabel("Abrir repetición").setInputFiles(upload);
  await expect(note).toContainText("otro programa");

  // Back to the first program, run once: the same file now replays that run exactly.
  await page.getByRole("button", { name: "Deshacer" }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.locator(".kids-replay-button")).toBeEnabled();
  await page.getByLabel("Abrir repetición").setInputFiles(upload);
  await expect(page.locator(".kids-replay-button")).toBeEnabled();
  await expect.poll(() => actor.evaluate((node) => (node as HTMLElement).style.left)).toBe(left);

  await page.getByLabel("Abrir repetición").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"kind":"nope"}'),
  });
  await expect(note).toContainText("no es una repetición válida");
});

test("Rewind goes back one block at a time and Step comes forward to the same place (#1578)", async ({
  page,
}) => {
  await openScene(page);
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  const actor = page.locator(".kids-studio-stage-actor").first();
  const left = () => actor.evaluate((node) => parseFloat((node as HTMLElement).style.left));
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.locator(".kids-replay-button")).toBeEnabled();
  const end = await left();
  const back = page.getByRole("button", { name: "Retroceder", exact: true });
  await back.click();
  const one = await left();
  expect(one).toBeLessThan(end);
  await back.click();
  const two = await left();
  expect(two).toBeLessThan(one);
  await expect(back).toBeDisabled();
  const step = page.getByRole("button", { name: "Paso", exact: true });
  await step.click();
  expect(await left()).toBe(one);
  await step.click();
  expect(await left()).toBe(end);
});

test("the run says which block changed each value and jumps to that step (#1579, #1580)", async ({
  page,
}) => {
  await openScene(page);
  await page.getByRole("textbox", { name: "Nombre" }).fill("Puntos");
  await page.getByRole("button", { name: "+ Crear variable" }).click();
  await page.getByRole("spinbutton", { name: "Número" }).fill("7");
  await page.getByRole("button", { name: "+ Fijar valor" }).click();
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.locator(".kids-replay-button")).toBeEnabled();
  const history = page.locator(".kids-run-history");
  await expect(history).toContainText("Qué cambió (1)");
  await history.locator("summary").click();
  const change = history.getByRole("button", { name: /Paso 1: Puntos 0 → 7 · Fijar valor/ });
  await expect(change).toBeVisible();
  // Go to the end, then jump back to the step that set the value.
  await change.click();
  await expect(change).toHaveAttribute("aria-current", "step");
});

test("a run is compared with the last one: the same program gives the same run (#1581)", async ({
  page,
}) => {
  await openScene(page);
  for (let i = 0; i < 2; i++)
    await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  const play = page.getByRole("button", { name: "Jugar", exact: true });
  await play.click();
  await expect(page.locator(".kids-replay-button")).toBeEnabled();
  // Only one finished run so far: nothing to compare with.
  await expect(page.locator(".kids-run-compare")).toHaveCount(0);
  await play.click();
  await expect(page.locator(".kids-replay-button")).toBeEnabled();
  const compare = page.locator(".kids-run-compare");
  await compare.locator("summary").click();
  await expect(compare).toContainText("Igual que la vez anterior");

  // After an edit the sentence says where they stop agreeing, and the button goes there.
  await page.getByRole("button", { name: "+ Girar a la derecha", exact: true }).click();
  await play.click();
  await expect(page.locator(".kids-replay-button")).toBeEnabled();
  await compare.locator("summary").click();
  await expect(compare).toContainText("antes eran 2 pasos y ahora 3");
  await compare.getByRole("button", { name: "Ir a ese paso" }).click();
});
