import { expect, test } from "@playwright/test";

// Issue #351: a first visit opens in Spanish and remembers a changed language.
test.use({ storageState: { cookies: [], origins: [] } });

test("first visit opens in Spanish and remembers the learner's language choice", async ({
  page,
}) => {
  await page.goto("/");
  const openMenu = async () => {
    const menuButton = page.getByRole("button", { name: "Show app menu" });
    if (await menuButton.isVisible().catch(() => false)) await menuButton.click();
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
