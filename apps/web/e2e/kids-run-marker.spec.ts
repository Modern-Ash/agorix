import { expect, test } from "./fixtures.js";
import { clickCreateScene } from "./helpers.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

test("Ori notices a condition that never held, and points at its block", async ({ page }) => {
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
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Si el ratón está pulsado, mover 1" }).click();
  // Nothing is said while the program runs or before it has run.
  await expect(page.locator(".kids-ori-noticed")).toHaveCount(0);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  const marker = page.getByRole("button", { name: /Ori vio algo/ });
  await expect(marker).toBeVisible();
  // The adult counter notes that Ori noticed something: a whole number, nothing else.
  const counters = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("agorix.kids.indicators.v1") ?? "{}"),
  );
  expect(
    Object.values(counters.days as Record<string, { oriNoticed: number }>)[0]!.oriNoticed,
  ).toBe(1);
  await marker.click();
  await expect(page.locator(".kids-ori-noticed-panel")).toContainText("dijo que no");
  await page.getByRole("button", { name: "Ver en el programa" }).click();
  await expect(page.locator('.kids-program-block[data-finding="true"]')).toHaveCount(1);
  await expect(page.locator('.kids-program-block[data-finding="true"]')).toContainText(
    "Si ratón pulsado",
  );
});

test("nothing is noticed in a run that did what it said", async ({ page }) => {
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
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Paso", exact: true })).toBeEnabled();
  await expect(page.locator(".kids-ori-noticed")).toHaveCount(0);
});

test("Ori offers the message that is missing, shows the block, and only adds it when accepted", async ({
  page,
}) => {
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
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Agregar personaje" }).click();
  await page.getByRole("combobox", { name: "Cuando" }).selectOption("onMessage");
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("button", { name: /Ori vio algo/ }).click();
  await expect(page.locator(".kids-ori-noticed-panel")).toContainText("nadie lo manda");
  const diff = page.getByTestId("ori-fix-diff");
  await expect(diff).toContainText("Enviar mensaje");
  // Nothing was added yet: the first character still has only its move.
  await page.getByRole("group", { name: "Personajes" }).getByRole("button").first().click();
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
  await page.getByRole("group", { name: "Personajes" }).getByRole("button").last().click();
  await page.getByRole("button", { name: /Ori vio algo/ }).click();
  await page.getByRole("button", { name: "Usar este cambio" }).click();
  // The decision is in the evidence log (no text) and counts as a fix used.
  const events = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("agorix.kids.reflections.v1") ?? "[]"),
  );
  expect(events).toContainEqual(
    expect.objectContaining({ kind: "proposalDecided", decision: "accept" }),
  );
  const counters = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("agorix.kids.indicators.v1") ?? "{}"),
  );
  expect(
    Object.values(counters.days as Record<string, { oriFixesUsed: number }>)[0]!.oriFixesUsed,
  ).toBe(1);
  await page.getByRole("group", { name: "Personajes" }).getByRole("button").first().click();
  await expect(page.locator(".kids-program-block")).toHaveCount(2);
  await expect(page.locator(".kids-program-block").last()).toContainText("Enviar mensaje");
});

test("the timeline scrubs the run, and Ori takes you to the moment it noticed", async ({
  page,
}) => {
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
  await page.getByRole("button", { name: "+ Si el ratón está pulsado, mover 1" }).click();
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  const actor = page.locator(".kids-studio-stage-actor").first();
  const start = await actor.evaluate((node) => (node as HTMLElement).style.left);
  // No timeline before a run.
  await expect(page.locator(".kids-timeline")).toHaveCount(0);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  const slider = page.locator('.kids-timeline input[type="range"]');
  await expect(slider).toBeVisible();
  await expect(slider).toHaveValue("2");
  const end = await actor.evaluate((node) => (node as HTMLElement).style.left);
  expect(end).not.toBe(start);
  // Dragging back shows the scene as it was then.
  await slider.fill("0");
  await expect.poll(() => actor.evaluate((node) => (node as HTMLElement).style.left)).toBe(start);
  await slider.fill("2");
  await expect.poll(() => actor.evaluate((node) => (node as HTMLElement).style.left)).toBe(end);
  // Ori's finding is about the first step: "see when" goes there.
  await page.getByRole("button", { name: /Ori vio algo/ }).click();
  await page.getByRole("button", { name: "Ver cuándo pasó" }).click();
  await expect(slider).toHaveValue("0");
});

test("Ori notices a hidden character and offers to show it, only if accepted", async ({ page }) => {
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
  await page.getByRole("button", { name: "+ Esconder", exact: true }).click();
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("button", { name: /Ori vio algo/ }).click();
  await expect(page.locator(".kids-ori-noticed-panel")).toContainText("no se ve");
  await expect(page.getByTestId("ori-fix-diff")).toContainText("Mostrar");
  await expect(page.locator(".kids-program-block")).toHaveCount(2);
  await page.getByRole("button", { name: "Usar este cambio" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(3);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Paso", exact: true })).toBeEnabled();
  await expect(page.locator(".kids-ori-noticed")).toHaveCount(0);
});

async function openNoticedScene(page: import("@playwright/test").Page) {
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
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Agregar personaje" }).click();
  await page.getByRole("combobox", { name: "Cuando" }).selectOption("onMessage");
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("button", { name: /Ori vio algo/ }).click();
}

test("the child can ask Ori to say it another way, and only the finding travels", async ({
  page,
}) => {
  let sent: Record<string, unknown> | undefined;
  await page.route("**/api/tutor/run-finding/rephrase", async (route) => {
    sent = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ text: "Este personaje espera un mensaje que nadie manda." }),
    });
  });
  await openNoticedScene(page);
  // Nothing is asked until the child taps.
  expect(sent).toBeUndefined();
  const first = await page.locator(".kids-ori-noticed-panel p").first().innerText();
  await page.getByRole("button", { name: "Decímelo de otra forma" }).click();
  await expect(page.getByTestId("ori-rephrase")).toContainText("espera un mensaje que nadie manda");
  // The first sentence is still there, and the new one sits below it.
  await expect(page.locator(".kids-ori-noticed-panel")).toContainText(first);
  expect(Object.keys(sent!).sort()).toEqual(["band", "finding", "local", "locale", "version"]);
  expect(JSON.stringify(sent)).not.toMatch(/vamos|scripts\[|actor:|studio-actor/);
  const counters = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("agorix.kids.indicators.v1") ?? "{}"),
  );
  expect(
    Object.values(counters.days as Record<string, { oriRephrased: number }>)[0]!.oriRephrased,
  ).toBe(1);
});

test("without a model the button goes away; a failed answer leaves the first sentence", async ({
  page,
}) => {
  await page.route("**/api/tutor/run-finding/rephrase", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"x"}' }),
  );
  await openNoticedScene(page);
  const first = await page.locator(".kids-ori-noticed-panel p").first().innerText();
  await page.getByRole("button", { name: "Decímelo de otra forma" }).click();
  await expect(page.getByRole("button", { name: "Decímelo de otra forma" })).toHaveCount(0);
  await expect(page.locator(".kids-ori-noticed-panel")).toContainText(first);
  await expect(page.getByTestId("ori-rephrase-failed")).toHaveCount(0);
});

test("a failing server shows a short note and keeps the button", async ({ page }) => {
  await page.route("**/api/tutor/run-finding/rephrase", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"x"}' }),
  );
  await openNoticedScene(page);
  await page.getByRole("button", { name: "Decímelo de otra forma" }).click();
  await expect(page.getByTestId("ori-rephrase-failed")).toBeVisible();
  await expect(page.getByRole("button", { name: "Decímelo de otra forma" })).toBeVisible();
});
