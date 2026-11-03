import { expect, test, type Page } from "./fixtures.js";

async function openMap(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
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
}

const lookX = (page: Page) =>
  page
    .locator(".kids-ori-face")
    .first()
    .evaluate((face) => face.style.getPropertyValue("--ori-look-x"));

test("Ori's eyes follow the pointer and give way to the glance when it leaves (#1209)", async ({
  page,
}) => {
  await openMap(page);
  const face = page.locator(".kids-ori-face").first();
  await expect(face).toBeVisible();
  const box = (await face.boundingBox())!;
  await page.mouse.move(1278, box.y + box.height / 2);
  await expect.poll(async () => Number(await lookX(page))).toBeGreaterThan(0.5);
  await page.mouse.move(Math.max(2, box.x + box.width / 2 - 600), box.y + box.height / 2);
  await expect.poll(async () => Number(await lookX(page))).toBeLessThan(-1);
});

test("with reduced motion the eyes stay put and the window opens with its text whole (#1209)", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openMap(page);
  const face = page.locator(".kids-ori-face").first();
  const box = (await face.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2 - 600, box.y + box.height / 2);
  await page.waitForTimeout(150);
  expect(await lookX(page)).toBe("");
  await page.getByRole("button", { name: "Hablar con Ori" }).click();
  const dialog = page.getByRole("dialog", { name: "Ori te acompaña" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.locator('p[class="kids-ori-guide-message"] span[aria-hidden="true"]'),
  ).toHaveText(/Elegí un explorador y un mundo\. ¿Qué te gustaría que pase ahí\?/);
  await dialog.getByRole("button", { name: "Cerrar" }).click();
  await expect(dialog).toHaveCount(0);
});

test("without reduced motion the message types in and the window folds away (#1209)", async ({
  page,
}) => {
  await openMap(page);
  await page.getByRole("button", { name: "Hablar con Ori" }).click();
  const dialog = page.getByRole("dialog", { name: "Ori te acompaña" });
  const typed = dialog.locator('p[class="kids-ori-guide-message"] span[aria-hidden="true"]');
  await expect(typed).toHaveText(
    /Elegí un explorador y un mundo\. ¿Qué te gustaría que pase ahí\?/,
  );
  await dialog.getByRole("button", { name: "Cerrar" }).click();
  await expect(dialog).toHaveAttribute("data-closing", "true");
  await expect(dialog).toHaveCount(0);
});
