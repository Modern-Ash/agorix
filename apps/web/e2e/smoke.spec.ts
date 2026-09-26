import { expect, test } from "@playwright/test";

test("main editor shell renders persistent blocks, stage and code", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Build with blocks. See the code." }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Blocks", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "When you press Run" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stage" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Code", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run" })).toBeVisible();
});

test("block edits update generated code", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Move [N] steps" }).click();
  await expect(page.getByText("sprite.move(10);")).toBeVisible();
  await page.getByLabel("Move block").getByRole("spinbutton").fill("24");
  await expect(page.getByText("sprite.move(24);")).toBeVisible();
});

test("block edits survive reload from canonical storage", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Move [N] steps" }).click();
  await page.getByLabel("Move block").getByRole("spinbutton").fill("24");
  await expect(page.getByText("sprite.move(24);")).toBeVisible();

  const stored = await page.evaluate(() => localStorage.getItem("agorix:default-project"));
  expect(stored).toContain('"program"');
  expect(stored).toContain('"metadata"');
  expect(stored).not.toContain("sprite.move");

  await page.reload();

  await expect(page.getByLabel("Move block").getByRole("spinbutton")).toHaveValue("24");
  await expect(page.getByText("sprite.move(24);")).toBeVisible();
});
