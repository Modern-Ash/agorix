import { expect, test } from "@playwright/test";

// Skeleton E2E spec (issue #11). Real learner-journey coverage lands in issue #31.
test("app shell renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Agorix" })).toBeVisible();
});
