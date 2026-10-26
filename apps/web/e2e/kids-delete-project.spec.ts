import { expect, test, type Page } from "@playwright/test";
import { reloadTo } from "./helpers.js";

// Issue #445: an adult can delete a free-world project; the child alone cannot.
test.use({ hasTouch: true, serviceWorkers: "block" });

async function openProjectsWithTwoFree(page: Page) {
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
  for (let index = 0; index < 2; index++) {
    await page.getByRole("button", { name: "Crear", exact: true }).click();
    await page.getByRole("button", { name: "¡Crear!" }).click();
    await page.getByRole("button", { name: "Tocá el mundo para poner la meta: 5, 3" }).click();
    await reloadTo(page, "#/proyectos");
    await page.getByRole("button", { name: "Mis proyectos" }).click();
  }
  await expect(page.locator(".kids-project-card")).toHaveCount(2);
}

async function passGate(page: Page, answer: string) {
  for (const digit of answer) {
    await page.getByRole("dialog").getByRole("button", { name: digit, exact: true }).click();
  }
  await page.getByRole("dialog").getByRole("button", { name: "Comprobar" }).click();
}

test("deleting needs the adult gate and a confirmation, and can be undone", async ({ page }) => {
  await openProjectsWithTwoFree(page);
  await page.locator(".kids-project-card").last().getByRole("button", { name: "Borrar" }).click();

  await passGate(page, "13");
  await expect(page.getByText("Probá otra vez.")).toBeVisible();
  await expect(page.locator(".kids-project-card")).toHaveCount(2);

  await passGate(page, "12");
  await expect(page.getByRole("button", { name: "Cancelar" })).toBeFocused();
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.locator(".kids-project-card")).toHaveCount(2);

  await page.locator(".kids-project-card").last().getByRole("button", { name: "Borrar" }).click();
  await passGate(page, "12");
  await page.getByRole("dialog").getByRole("button", { name: "Borrar", exact: true }).click();
  await expect(page.locator(".kids-project-card")).toHaveCount(1);
  await reloadTo(page, "#/proyectos");
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await expect(page.locator(".kids-project-card")).toHaveCount(1);

  await page.locator(".kids-project-card").getByRole("button", { name: "Borrar" }).click();
  await passGate(page, "12");
  await page.getByRole("dialog").getByRole("button", { name: "Borrar", exact: true }).click();
  await expect(page.locator(".kids-project-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.locator(".kids-project-card")).toHaveCount(1);
  await reloadTo(page, "#/proyectos");
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await expect(page.locator(".kids-project-card")).toHaveCount(1);
});
