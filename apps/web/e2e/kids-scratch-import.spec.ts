import { expect, test } from "./fixtures.js";

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
  await report.getByRole("button", { name: "Abrir la escena" }).click();
  await expect(page.locator(".kids-program-block").first()).toContainText("Mover");
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
