import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    localStorage.clear();
    for (const registration of await navigator.serviceWorker.getRegistrations()) {
      await registration.unregister();
    }
    for (const key of await caches.keys()) {
      await caches.delete(key);
    }
  });
  await page.reload();
});

async function openActivity(page: Page) {
  await page.getByRole("button", { name: "Compare two AI suggestions" }).click();
  const panel = page.getByTestId("model-comparison");
  await expect(panel).toHaveAttribute("data-stage", "inspect");
  return panel;
}

async function inspectAndPredict(page: Page, guesses: { a: boolean; b: boolean }) {
  const panel = page.getByTestId("model-comparison");
  await panel.getByRole("button", { name: "I looked at Proposal A" }).click();
  // Nothing can be predicted or run until both suggestions were looked at.
  await expect(panel.getByRole("button", { name: /Test both/ })).toHaveCount(0);
  await expect(panel.getByRole("radio", { name: "Will reach the goal" })).toHaveCount(0);
  await panel.getByRole("button", { name: "I looked at Proposal B" }).click();
  await expect(panel).toHaveAttribute("data-stage", "predict");
  const label = (guess: boolean) => (guess ? "Will reach the goal" : "Will not reach the goal");
  await page
    .getByTestId("card-proposal-a")
    .getByRole("radio", { name: label(guesses.a) })
    .check();
  await expect(panel.getByRole("button", { name: /Test both/ })).toHaveCount(0);
  await page
    .getByTestId("card-proposal-b")
    .getByRole("radio", { name: label(guesses.b) })
    .check();
  await expect(panel).toHaveAttribute("data-stage", "run");
}

async function concludeAndReflect(page: Page, conclusion: string) {
  const panel = page.getByTestId("model-comparison");
  await expect(panel).toHaveAttribute("data-stage", "conclude");
  await expect(panel.getByRole("button", { name: "Save my conclusion" })).toBeDisabled();
  await panel.getByRole("radio", { name: conclusion }).check();
  await expect(panel.getByRole("button", { name: "Save my conclusion" })).toBeDisabled();
  await panel.getByRole("radio", { name: "Running them and looking at what happened" }).check();
  await expect(panel).toHaveAttribute("data-stage", "reflect");
  await panel.getByRole("button", { name: "Save my conclusion" }).click();
  await expect(panel).toHaveAttribute("data-stage", "done");
}

test("learner inspects, predicts, runs isolated candidates and concludes from runtime evidence", async ({
  page,
}) => {
  const panel = await openActivity(page);
  await inspectAndPredict(page, { a: true, b: true });
  await panel.getByRole("button", { name: /Test both/ }).click();

  await expect(page.getByTestId("result-proposal-a")).toContainText(
    "reached the goal (blocks run: 1)",
  );
  await expect(page.getByTestId("result-proposal-b")).toContainText("did not reach the goal");
  await expect(page.getByTestId("result-proposal-b")).toContainText(
    "You predicted: Will reach the goal",
  );

  await concludeAndReflect(page, "Only one reaches the goal");
  const feedback = page.getByTestId("comparison-feedback");
  await expect(feedback).toHaveAttribute("data-evidence-backed", "true");
  await expect(feedback).toContainText("matches what the runs showed");
  await expect(feedback).toContainText("no best suggestion");
  await expect(panel).not.toContainText(/winner|best model|ranking/i);
});

test("a conclusion that contradicts the runs is not treated as evidence-backed", async ({
  page,
}) => {
  const panel = await openActivity(page);
  await inspectAndPredict(page, { a: true, b: false });
  await panel.getByRole("button", { name: /Test both/ }).click();
  await concludeAndReflect(page, "Both reach the goal");
  await expect(page.getByTestId("comparison-feedback")).toHaveAttribute(
    "data-evidence-backed",
    "false",
  );
  await expect(page.getByTestId("comparison-feedback")).toContainText("Look at the results again");
});

test("handles both proposals being valid and working", async ({ page }) => {
  const panel = await openActivity(page);
  await panel.getByLabel("Practice scenario").selectOption({ label: "Both reach the goal" });
  await inspectAndPredict(page, { a: true, b: true });
  await panel.getByRole("button", { name: /Test both/ }).click();
  await expect(page.getByTestId("result-proposal-a")).toContainText("reached the goal");
  await expect(page.getByTestId("result-proposal-b")).toContainText("reached the goal");
  await concludeAndReflect(page, "Both reach the goal");
  await expect(page.getByTestId("comparison-feedback")).toHaveAttribute(
    "data-evidence-backed",
    "true",
  );
});

test("handles one invalid proposal without crashing or hiding it", async ({ page }) => {
  const panel = await openActivity(page);
  await panel.getByLabel("Practice scenario").selectOption({ label: "One is not a valid program" });
  await expect(page.getByTestId("card-proposal-b")).toContainText("not a valid program");
  await inspectAndPredict(page, { a: true, b: false });
  await panel.getByRole("button", { name: /Test both/ }).click();
  await expect(page.getByTestId("result-proposal-b")).toContainText("not a valid program");
  await concludeAndReflect(page, "Only one reaches the goal");
  await expect(page.getByTestId("comparison-feedback")).toHaveAttribute(
    "data-evidence-backed",
    "true",
  );
});

test("changing the scenario starts the activity over", async ({ page }) => {
  const panel = await openActivity(page);
  await panel.getByRole("button", { name: "I looked at Proposal A" }).click();
  await panel.getByLabel("Practice scenario").selectOption({ label: "Both reach the goal" });
  await expect(panel).toHaveAttribute("data-stage", "inspect");
  await expect(panel.getByRole("button", { name: "I looked at Proposal A" })).toBeEnabled();
});

test("an inconclusive answer is saved without being called a mismatch", async ({ page }) => {
  const panel = await openActivity(page);
  await inspectAndPredict(page, { a: true, b: false });
  await panel.getByRole("button", { name: /Test both/ }).click();
  await concludeAndReflect(page, "I cannot tell yet");
  const feedback = page.getByTestId("comparison-feedback");
  await expect(feedback).toContainText("When you are ready, look at the results again");
  await expect(feedback).not.toContainText("showed something different");
});

test("each prediction group names its proposal and a new scenario never shows old results", async ({
  page,
}) => {
  const panel = await openActivity(page);
  await inspectAndPredict(page, { a: true, b: false });
  await expect(panel.getByRole("group", { name: /will Proposal A reach the goal/ })).toBeVisible();
  await expect(panel.getByRole("group", { name: /will Proposal B reach the goal/ })).toBeVisible();
  await panel.getByRole("button", { name: /Test both/ }).click();
  await expect(page.getByTestId("result-proposal-a")).toBeVisible();
  await panel.getByLabel("Practice scenario").selectOption({ label: "Both reach the goal" });
  await expect(page.getByTestId("result-proposal-a")).toHaveCount(0);
  await expect(panel).toHaveAttribute("data-stage", "inspect");
});
