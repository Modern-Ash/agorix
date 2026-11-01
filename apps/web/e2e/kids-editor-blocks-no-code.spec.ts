import { expect, test } from "./fixtures.js";

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("agorix.kids.freeToScene.off.v1", "1"));
});

test("blocks tab does not show the code, the code tab does", async ({ page }) => {
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
  await page
    .getByRole("button", { name: /^Crear$/ })
    .first()
    .click();
  await page.getByRole("button", { name: "¡Crear!" }).click();
  await page.getByRole("button", { name: "+ mover" }).click();

  await expect(page.getByRole("button", { name: "Bloques", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".kids-code-strip")).toHaveCount(0);
  await expect(page.getByText("El código se arma solo con tus bloques")).toHaveCount(0);

  await page.getByRole("button", { name: "Código", exact: true }).click();
  await expect(page.getByText("when start")).toBeVisible();
});
