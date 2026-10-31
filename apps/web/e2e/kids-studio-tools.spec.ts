import { expect, test } from "@playwright/test";

test.use({ hasTouch: true, serviceWorkers: "block" });

// Issue #1126: the tools an editor needs are reachable in Escena libre from a fresh session, with
// no flags: first steps, Play/Step debugging on the real runtime trace, undo/redo and export.
const PROGRESS = { onboarded: true, avatar: "🐸", stars: 0, done: {} };

async function openScene(page: import("@playwright/test").Page) {
  await page.goto("/kids");
  await page.evaluate((progress) => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem("agorix.kids.progress.v1", JSON.stringify(progress));
  }, PROGRESS);
  await page.reload();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
}

test("first steps follow the child, never block, end after Step and come back with Ayuda", async ({
  page,
}) => {
  await openScene(page);
  const coach = page.getByTestId("studio-tutorial");
  await expect(coach).toContainText("Elegí un bloque");

  // Play is never blocked: the coach just moves to what is next.
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await expect(coach).toContainText("Jugar");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(coach).toContainText("Paso");
  await page.getByRole("button", { name: "Paso", exact: true }).click();
  await expect(coach).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId("studio-tutorial")).toHaveCount(0);
  await page.getByRole("button", { name: "Ayuda", exact: true }).click();
  await expect(page.getByTestId("studio-tutorial")).toBeVisible();
  await page.getByRole("button", { name: "Listo, no mostrar más" }).click();
  await expect(page.getByTestId("studio-tutorial")).toHaveCount(0);
});

test("Play, Step and Back to start debug the run on the runtime trace; undo and redo restore blocks", async ({
  page,
}) => {
  await openScene(page);
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  const blocks = page.getByRole("button", { name: /^Quitar bloque \d+$/ });
  await expect(blocks).toHaveCount(2);

  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText(/2 bloques ejecutados/)).toBeVisible();
  const stage = page.getByRole("group", { name: "Escenario" });
  const before = await stage.innerHTML();
  await page.getByRole("button", { name: "Paso", exact: true }).click();
  expect(await stage.innerHTML()).not.toBe(before);
  await page.getByRole("button", { name: "Volver al inicio" }).click();
  await expect(page.getByText(/2 bloques ejecutados/)).toHaveCount(0);

  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(blocks).toHaveCount(1);
  await page.getByRole("button", { name: "Rehacer" }).click();
  await expect(blocks).toHaveCount(2);
});

test("a scene exports as a .agorix file from the editor", async ({ page }) => {
  await openScene(page);
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar escena" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.agorix$/);
});
