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

const sprite = (page: Page) => page.getByTestId("stage-sprite");
const play = (page: Page) => page.getByTestId("play-controls");

async function addMoves(page: Page, count: number) {
  for (let index = 0; index < count; index += 1) {
    await page.getByRole("button", { name: "Move", exact: true }).first().click();
  }
}

test("Play and Stop are visible on the first screen, next to the stage, without helper text", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const controls = play(page);
  await expect(controls.getByRole("button", { name: "Run" })).toBeInViewport();
  await expect(controls.getByRole("button", { name: "Stop" })).toBeInViewport();
  await expect(controls.getByRole("button", { name: "Reset" })).toBeInViewport();
  // The controls live inside the stage panel, like the green flag above the Scratch stage.
  const stagePanel = page.locator(".stage-panel");
  await expect(stagePanel.getByTestId("play-controls")).toBeVisible();
  await expect(page.locator(".topbar").getByRole("button", { name: "Run" })).toHaveCount(0);
  await expect(controls.getByRole("button", { name: "Stop" })).toBeDisabled();
  await expect(page.locator(".stage-canvas")).toBeInViewport();
});

test("Run animates the actor with visible progress, Stop interrupts, Reset restores the start", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await addMoves(page, 3);
  const startX = await sprite(page).getAttribute("data-x");
  await play(page).getByRole("button", { name: "Run" }).click();
  await expect(play(page).getByRole("button", { name: "Run" })).toBeDisabled();
  await expect(page.getByTestId("stage-progress")).toBeVisible();
  await expect(page.getByTestId("stage-progress")).toContainText(/Step \d of \d/);
  await expect.poll(() => sprite(page).getAttribute("data-x")).not.toBe(startX);

  await play(page).getByRole("button", { name: "Stop" }).click();
  await expect(page.locator(".stage-panel")).toHaveAttribute("data-stage-phase", "stopped");
  await expect(page.getByTestId("stage-feedback")).toContainText("Stopped");
  await expect(page.getByTestId("stage-progress")).toHaveCount(0);
  await expect(play(page).getByRole("button", { name: "Run" })).toBeEnabled();

  await play(page).getByRole("button", { name: "Reset" }).click();
  await expect(sprite(page)).toHaveAttribute("data-x", startX ?? "");
});

test("closing the stage panel keeps Run, Stop and Reset reachable from the header", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: "Close Preview" }).click();
  await expect(page.locator(".stage-panel")).toHaveCount(0);
  const header = page.locator(".topbar");
  await expect(header.getByRole("button", { name: "Run" })).toBeVisible();
  await expect(header.getByRole("button", { name: "Stop" })).toBeVisible();
  await expect(header.getByRole("button", { name: "Reset" })).toBeVisible();
  await expect(page.getByTestId("play-controls")).toHaveCount(1);
});
