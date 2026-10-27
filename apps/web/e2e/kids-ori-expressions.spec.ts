import { expect, test, type Page } from "@playwright/test";

test.use({ hasTouch: true, serviceWorkers: "block", deviceScaleFactor: 2 });

const FACE = ".kids-ori-float-trigger .kids-ori-face";

async function openMission(page: Page) {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/kids");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  });
  await page.reload();
  await page.getByRole("button", { name: "Misión 1" }).click();
  await expect(page.locator(".kids-ori-float-trigger")).toBeVisible();
}

function trigger(page: Page) {
  return page.locator(".kids-ori-float-trigger");
}

/** A pixel capture of the real character, one per expression (issue #817). */
async function expectFace(page: Page, expression: string) {
  const face = page.locator(FACE);
  await expect(face).toHaveAttribute("data-ori-expression", expression);
  await expect(face).toHaveScreenshot(`ori-${expression}.png`, {
    animations: "disabled",
    maxDiffPixelRatio: 0.02,
  });
}

async function runMoves(page: Page, steps: readonly ("1" | "2" | "3" | "4" | "5")[]) {
  for (const [index, value] of steps.entries()) {
    await page.getByRole("button", { name: "+ mover", exact: true }).click();
    await page
      .getByRole("combobox", { name: `mover ${index + 1}`, exact: true })
      .selectOption(value);
  }
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  const prediction = page.getByRole("dialog");
  await expect(prediction).toBeVisible();
  await prediction.getByRole("button", { name: "Sí", exact: true }).click();
}

async function earnOriIdea(page: Page) {
  for (const name of ["Pista 1", "Pista 2"]) {
    await page.getByRole("button", { name, exact: true }).click();
  }
}

test("Ori is neutral before anything happened", async ({ page }) => {
  await openMission(page);
  await expect(trigger(page)).toHaveAttribute("data-ori-state", "idle");
  await expectFace(page, "neutral");
});

test("Ori is thinking while the idea request is in flight", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/tutor/ori", async (route) => {
    await gate;
    await route.fulfill({ status: 503, body: "" });
  });
  await openMission(page);
  await expect(trigger(page)).toHaveAttribute("data-ori-state", "thinking");
  await expectFace(page, "thinking");
  release();
  await expect(trigger(page)).toHaveAttribute("data-ori-state", "idle");
});

test("Ori is curious while an idea waits for review", async ({ page }) => {
  await openMission(page);
  await earnOriIdea(page);
  await expect(trigger(page)).toHaveAttribute("data-ori-state", "proposal");
  await expectFace(page, "curious");
});

test("Ori is happy when the run passed the goal", async ({ page }) => {
  await openMission(page);
  await runMoves(page, ["5"]);
  await expect(trigger(page)).toHaveAttribute("data-ori-state", "observing");
  await expectFace(page, "happy");
});

test("Ori celebrates when the run reached the goal", async ({ page }) => {
  await openMission(page);
  await runMoves(page, ["4"]);
  await expect(trigger(page)).toHaveAttribute("data-ori-state", "observing");
  await expectFace(page, "celebrate");
});

test("Ori encourages after a run that hit a wall", async ({ page }) => {
  await openMission(page);
  // The move select only goes to 5, so a second block takes the character past the grid.
  await runMoves(page, ["5", "1"]);
  await expect(trigger(page)).toHaveAttribute("data-ori-state", "observing");
  await expectFace(page, "encourage");
});
