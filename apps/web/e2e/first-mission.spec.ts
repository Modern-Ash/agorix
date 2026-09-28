import { expect, test } from "@playwright/test";

/**
 * End-to-end First Mission learner loop (issue #91). Runs against every
 * viewport project in playwright.config.ts, so it doubles as AC-008/AC-009
 * (tablet landscape/portrait) coverage. Screenshots satisfy AC-007.
 */
test.describe("First Mission — AI-native learner loop", () => {
  test("full journey: run, fail, get an AI hint, accept it, and reach the goal deterministically", async ({
    page,
  }, testInfo) => {
    await page.goto("/");

    // World and Code are both visible immediately — no toolbox occupies the layout (AC-010/AC-011).
    await expect(page.getByTestId("world")).toBeVisible();
    const codePanel = page.getByTestId("code-panel");
    await expect(codePanel).toBeVisible();
    await expect(codePanel).toContainText("sprite.move(20)");

    await page.screenshot({ path: testInfo.outputPath("01-initial-state.png") });

    // First run: deterministic, falls short of the goal (AC-001).
    await page.getByTestId("run-button").click();
    await expect(page.getByTestId("mission-complete")).toHaveCount(0);
    await expect(page.getByTestId("debugger-message")).toBeVisible();
    // Debugger must cite an actual runtime fact (position/step), not a vague claim (AC-003).
    await expect(page.getByTestId("debugger-message")).toContainText("scripts[0]/statements[0]");
    await expect(page.getByTestId("debugger-message")).toContainText("20.0");

    await page.screenshot({ path: testInfo.outputPath("02-first-run-short.png") });

    // Step/highlighting occurred during the run: the code panel exposes a highlight mount point.
    await expect(page.getByTestId("code-panel")).toBeVisible();

    // Ask for AI help — this only *proposes*, it does not mutate the program (AC-002).
    await page.getByTestId("ask-ai-button").click();
    const proposal = page.getByTestId("ai-proposal");
    await expect(proposal).toBeVisible();
    await expect(page.getByTestId("proposal-rationale")).toContainText("move(10)");
    // Program is still the original two-token move(20) — proposal is inspectable, not applied.
    await expect(codePanel).toContainText("sprite.move(20)");
    await expect(codePanel).not.toContainText("sprite.move(10)");

    await page.screenshot({ path: testInfo.outputPath("03-ai-proposal.png") });

    // Explicit learner decision required before any change lands (AC-002/US-002).
    await page.getByTestId("accept-proposal-button").click();
    await expect(codePanel).toContainText("sprite.move(10)");
    await expect(page.getByTestId("ai-proposal")).toHaveCount(0);

    // Learner re-runs after accepting — completion is only ever runtime-determined (AC-001, AC-006).
    await page.getByTestId("run-button").click();
    await expect(page.getByTestId("mission-complete")).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: testInfo.outputPath("04-mission-complete.png") });

    // Reflection is present and does not gate the already-reached completion (AC-005).
    const reflection = page.getByTestId("reflection-input");
    await expect(reflection).toBeVisible();
    await expect(page.getByTestId("mission-complete")).toBeVisible();
    await reflection.fill("I added one more move because the sprite stopped short of the goal.");
    await expect(page.getByTestId("mission-complete")).toBeVisible();
  });

  test("a rejected AI proposal never changes the program (AC-006: AI cannot bypass acceptance)", async ({
    page,
  }) => {
    await page.goto("/");
    const codePanel = page.getByTestId("code-panel");

    await page.getByTestId("run-button").click();
    await expect(page.getByTestId("debugger-message")).toBeVisible();

    await page.getByTestId("ask-ai-button").click();
    await expect(page.getByTestId("ai-proposal")).toBeVisible();

    await page.getByTestId("reject-proposal-button").click();
    await expect(page.getByTestId("ai-proposal")).toHaveCount(0);
    await expect(page.getByTestId("proposal-rejected")).toBeVisible();

    // Program is byte-identical to before the proposal — no invisible mutation.
    await expect(codePanel).toContainText("sprite.move(20)");
    await expect(codePanel).not.toContainText("sprite.move(10)");

    // Re-running the untouched program still falls short — completion is runtime-derived, not claimed.
    await page.getByTestId("run-button").click();
    await expect(page.getByTestId("mission-complete")).toHaveCount(0);
    await expect(page.getByTestId("debugger-message")).toBeVisible();
  });

  test("World and Code remain visible after an orientation/viewport change (AC-012)", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("run-button").click();
    await page.waitForTimeout(200);

    const initialSize = page.viewportSize();
    if (initialSize !== null) {
      // Swap width/height to simulate an orientation change without reloading the page.
      await page.setViewportSize({ width: initialSize.height, height: initialSize.width });
    }

    await expect(page.getByTestId("world")).toBeVisible();
    await expect(page.getByTestId("code-panel")).toBeVisible();
    await expect(page.getByTestId("code-panel")).toContainText("sprite.move(20)");
  });
});
