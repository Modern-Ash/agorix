import { expect, test } from "./fixtures.js";
import { clickCreateScene } from "./helpers.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

const lit = (value: string | number, type = 4) => [1, [type, String(value)]];
const block = (opcode: string, extra: Record<string, unknown> = {}) => ({
  opcode,
  next: null,
  parent: null,
  inputs: {},
  fields: {},
  shadow: false,
  topLevel: false,
  ...extra,
});

const PROJECT = {
  targets: [
    { isStage: true, name: "Stage", variables: {}, blocks: {} },
    {
      isStage: false,
      name: "Cat",
      x: 0,
      y: 0,
      direction: 90,
      size: 100,
      variables: {},
      blocks: {
        hat: block("event_whenflagclicked", { next: "move", topLevel: true }),
        move: block("motion_movesteps", { next: "glide", inputs: { STEPS: lit(30) } }),
        glide: block("motion_glideto"),
      },
    },
  ],
};

test("a Scratch project becomes a free scene, with a report of what could not come across", async ({
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
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page.getByLabel("Importar de Scratch (.sb3)").setInputFiles({
    name: "project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(PROJECT)),
  });
  const report = page.locator(".kids-scratch-report");
  await expect(report).toContainText("1 objeto(s)");
  await expect(report).toContainText("1 bloque(s)");
  await report.locator("summary").click();
  await expect(report).toContainText("motion_glideto");
  // Ori says why in plain words, and promises the idea will be shown before it is used.
  await expect(page.getByTestId("cut-explanations")).toContainText("deslizarse a");
  await expect(page.getByTestId("cut-ideas-note")).toContainText("vos decidís");
  await report.getByRole("button", { name: "Abrir la escena" }).click();
  await expect(page.locator(".kids-program-block").first()).toContainText("Mover");
});

test("Ori offers a replacement for a cut block as an idea, shown before it is used (#1312)", async ({
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
    localStorage.setItem(
      "agorix.kids.adults.v1",
      JSON.stringify({ oriSuggestions: true, readAloud: true, dailyLimitMinutes: 30 }),
    );
  });
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page.getByLabel("Importar de Scratch (.sb3)").setInputFiles({
    name: "project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(PROJECT)),
  });
  await page
    .locator(".kids-scratch-report")
    .getByRole("button", { name: "Abrir la escena" })
    .click();
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
  await page.getByRole("button", { name: /^(Mostrar ayuda de Ori|Abrir Ori)$/ }).click();
  await page.getByRole("button", { name: /Ir a un lugar al azar \(en lugar de/ }).click();
  // Nothing is added yet: the block is a ghost with the preview of what it would do.
  await expect(page.getByTestId("ori-ghost-block")).toHaveCount(1);
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
  await page.getByTestId("intent-card").getByRole("button", { name: "No usar" }).click();
  await expect(page.getByTestId("ori-ghost-block")).toHaveCount(0);
  await page.getByRole("button", { name: /Ir a un lugar al azar \(en lugar de/ }).click();
  await page.getByTestId("intent-card").getByRole("button", { name: "Usar idea" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(2);
  // One undo takes it back.
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
});

test("a scene that did not come from an import never shows those ideas (#1312)", async ({
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
    localStorage.setItem(
      "agorix.kids.adults.v1",
      JSON.stringify({ oriSuggestions: true, readAloud: true, dailyLimitMinutes: 30 }),
    );
  });
  await page.reload();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await clickCreateScene(page);
  await page.getByRole("button", { name: /^(Mostrar ayuda de Ori|Abrir Ori)$/ }).click();
  await expect(page.getByRole("button", { name: /en lugar de/ })).toHaveCount(0);
});

test("a file that is not a Scratch project says so and changes nothing", async ({ page }) => {
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
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page.getByLabel("Importar de Scratch (.sb3)").setInputFiles({
    name: "nope.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"hello":1}'),
  });
  await expect(page.getByRole("status").filter({ hasText: "no se pudo importar" })).toBeVisible();
  await expect(page.locator(".kids-scratch-report")).toHaveCount(0);
});

test("a scene can be exported as a Scratch .sb3 and imported back (#1312)", async ({ page }) => {
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
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
  await page.getByRole("button", { name: "Volver a Crear" }).click();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByTestId("export-scratch")
    .click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.sb3$/);
  const path = await file.path();
  const { readFileSync } = await import("node:fs");
  const bytes = readFileSync(path);
  // A zip that holds project.json, readable by the importer.
  expect(bytes.subarray(0, 2).toString("latin1")).toBe("PK");
  expect(bytes.includes(Buffer.from("project.json"))).toBe(true);
  await expect(page.getByRole("status")).toContainText("Exporté 1 bloque(s) a Scratch");
  // And it comes back through "Importar de Scratch".
  await page.getByLabel("Importar de Scratch (.sb3)").setInputFiles({
    name: "back.sb3",
    mimeType: "application/zip",
    buffer: bytes,
  });
  const report = page.locator(".kids-scratch-report");
  await expect(report).toContainText("1 objeto(s)");
  await report.getByRole("button", { name: "Abrir la escena" }).click();
  await expect(page.locator(".kids-program-block").first()).toContainText("Mover");
});
