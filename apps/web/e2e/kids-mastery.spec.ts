import { expect, test, type Page } from "@playwright/test";

test.use({ hasTouch: true, serviceWorkers: "block" });

// Issue #610: what the runs showed is kept as counters on the device, with no screen showing it yet.
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
  await page.getByRole("button", { name: "Crear escena" }).click();
}

const mastery = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("agorix.kids.mastery.v1") ?? "null"));

test("a finished run, a guess that matched and help are kept as counters, never as program or text", async ({
  page,
}) => {
  await openScene(page);
  expect(await mastery(page)).toBeNull();
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  let state = await mastery(page);
  expect(state.version).toBe(1);
  expect(state.concepts["programming.sequence"].counts).toMatchObject({
    runs: 1,
    independentRuns: 1,
    helpedRuns: 0,
  });
  // A scene is a free creation, so finishing one without help is already Crea.
  expect(state.concepts["programming.sequence"].stage).toBe(4);
  expect(state.concepts["programming.repetition"].stage).toBe(0);

  // A guess that matches what the run did counts as explaining.
  await page.getByRole("radio", { name: "a la derecha" }).check();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByTestId("coach-prediction")).toContainText("y pasó eso");
  state = await mastery(page);
  expect(state.concepts["programming.sequence"].counts.explained).toBe(1);
  expect(state.concepts["programming.sequence"].stage).toBe(5);

  // Help from Ori is counted as help.
  await page.getByRole("button", { name: "Pedirle una idea a Ori" }).click();
  await page.getByRole("button", { name: "Usar idea" }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  state = await mastery(page);
  expect(state.concepts["programming.sequence"].counts.helpedRuns).toBe(1);

  // Only counters, stages and changes with a day: nothing the child built or wrote.
  const raw = JSON.stringify(state);
  expect(raw).not.toMatch(/Hola|scripts|statements|actor|project|escena/i);
  expect(raw).not.toMatch(/\d{2}:\d{2}/);
  expect(Object.keys(state)).toEqual(["version", "concepts"]);
});

test("a free scene that repeats a block reaches the repetition concept", async ({ page }) => {
  await openScene(page);
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
  await page.getByRole("button", { name: "Repetir estos bloques", exact: true }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  const state = await mastery(page);
  // Finished without help in a free scene: Crea.
  expect(state.concepts["programming.repetition"].stage).toBe(4);
  expect(state.concepts["programming.conditions"].stage).toBe(0);
});
