import { expect, test } from "@playwright/test";

// Issue #351: a first visit opens in Spanish and remembers a changed language.
test.use({ storageState: { cookies: [], origins: [] } });

test("Kids opens in Spanish and remembers the learner's language choice", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("heading", { name: "¡Hola!" })).toBeVisible();
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Hi!" })).toBeVisible();
});

test("the parked editor remembers the learner's language choice", async ({ page }) => {
  await page.goto("/advanced");
  const openMenu = async () => {
    const menuButton = page.getByRole("button", { name: /Show app menu|Mostrar menú/ });
    await menuButton.click();
  };
  await openMenu();
  const picker = page.getByLabel(/Idioma del producto|Product language/);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(picker).toHaveValue("es");

  await picker.selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.reload();
  await openMenu();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByLabel(/Idioma del producto|Product language/)).toHaveValue("en");
});
