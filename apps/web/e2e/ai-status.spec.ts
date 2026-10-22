import { expect, test } from "@playwright/test";

// Issue #352: the learner sees a calm AI status and a short loop, never a key field.
// The service worker would answer the health call before page.route can mock it.
test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.goto("/advanced");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "en");
  });
});

async function openCoach(page: import("@playwright/test").Page) {
  await page.reload();
  await page.getByRole("button", { name: "Use AI explain tool" }).click();
  return page.locator(".ai-coach-card");
}

test("server reports AI available: the card says AI on", async ({ page }) => {
  await page.route("**/api/tutor/health", (route) =>
    route.fulfill({ json: { configured: true, available: true } }),
  );
  const card = await openCoach(page);
  await expect(card.getByRole("status")).toHaveText("AI on");
  await expect(page.getByRole("button", { name: "Connect AI" })).toHaveCount(0);
});

test("server configured but down: calm message, work continues", async ({ page }) => {
  await page.route("**/api/tutor/health", (route) =>
    route.fulfill({ json: { configured: true, available: false } }),
  );
  const card = await openCoach(page);
  await expect(card.getByRole("status")).toHaveText("AI not available right now");
  await expect(card.getByText("You can keep working.")).toBeVisible();
  await page.getByRole("button", { name: "Move", exact: true }).click();
  await expect(page.getByLabel("Move block").getByRole("spinbutton")).toHaveValue("10");
});

test("the four-step loop follows the learner and secondary help is folded away", async ({
  page,
}) => {
  const card = await openCoach(page);
  await expect(card).toBeVisible();
  const steps = page.getByRole("list", { name: "Your steps with the AI" });
  await expect(steps.locator('[aria-current="step"]')).toHaveText("Ask");

  await page.getByRole("button", { name: "Move", exact: true }).click();
  await expect(steps.locator('[aria-current="step"]')).toHaveText("Run");

  await expect(page.getByRole("button", { name: "Get hint" })).toBeHidden();
  await page.getByText("More help").click();
  await expect(page.getByRole("button", { name: "Get hint" })).toBeVisible();
});
