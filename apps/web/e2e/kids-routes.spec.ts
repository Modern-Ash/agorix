import { expect, test, type Page } from "@playwright/test";

test.use({ hasTouch: true, serviceWorkers: "block" });

// Issue #596: reload, deep links, Back and Forward return to the same place without losing work.
async function seed(page: Page, onboarded = true) {
  await page.goto("/kids");
  await page.evaluate((done) => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    if (done)
      localStorage.setItem(
        "agorix.kids.progress.v1",
        JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
      );
  }, onboarded);
  await page.reload();
}

test("the address follows the screen and Back and Forward keep the scene's blocks", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await expect(page).toHaveURL(/#\/mapa$/);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await expect(page).toHaveURL(/#\/crear$/);
  await page.getByRole("button", { name: "Crear escena" }).click();
  await expect(page).toHaveURL(/#\/escena\/[A-Za-z0-9_-]+$/);
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(2);
  await page.goBack();
  await expect(page).toHaveURL(/#\/crear$/);
  await expect(page.getByRole("heading", { name: "Crear" })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/#\/escena\//);
  await expect(page.getByRole("heading", { name: "Escena libre" })).toBeVisible();
  await expect(page.locator(".kids-program-block")).toHaveCount(2);
});

test("reloading on a scene, a mission and a free project returns to it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Escena libre" })).toBeVisible();
  await expect(page.locator(".kids-program-block")).toHaveCount(1);

  await page.goto("/kids#/mapa");
  await page.getByRole("button", { name: "Misión 1" }).click();
  await expect(page).toHaveURL(/#\/mision\/1\/[a-z]+$/);
  await page.reload();
  await expect(page).toHaveURL(/#\/mision\/1\//);
  await expect(page.getByRole("button", { name: "Jugar", exact: true })).toBeVisible();

  await page.goto("/kids#/crear");
  await page
    .getByRole("button", { name: /Empezar|Crear!|¡Crear!/ })
    .first()
    .click();
  await expect(page).toHaveURL(/#\/libre\//);
  await page.reload();
  await expect(page).toHaveURL(/#\/libre\//);
  await expect(page.getByRole("button", { name: "Jugar", exact: true })).toBeVisible();
});

test("a deep link to something that does not exist lands on the map, and a stranger is not let in", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  for (const hash of ["#/escena/nope", "#/libre/nope", "#/mision/9/space", "#/admin", "#/x/../y"]) {
    await page.goto(`/kids${hash}`);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Mapa" })).toBeAttached();
  }
  // Someone who has not finished the first-run steps is not skipped past them by an address.
  await seed(page, false);
  await page.goto("/kids#/proyectos");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Mapa" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Proyectos" })).toHaveCount(0);
});
