/**
 * Adoption release gate (issue #203, epic #196).
 *
 * Journey map (issue numbering):
 *  1  palette drag -> insert -> inline edit -> Run ............ this file
 *  2  reorder -> nest -> duplicate -> delete -> Undo/Redo ..... this file
 *  3  touch-only First Mission ................................ input-parity.spec.ts
 *  4  keyboard / non-drag First Mission ....................... input-parity.spec.ts
 *  5  repeated pattern -> AI -> reject -> unchanged ........... this file
 *  6  repeated pattern -> AI -> accept -> Undo -> Redo ........ this file
 *  7  failed Run -> evidence -> hint -> correction ............ this file
 *  8  Step -> block/code/World synchronized ................... this file
 *  9  orientation change (no drift) ........................... input-parity.spec.ts + this file
 *  10 AI unavailable -> core visual programming works ......... this file
 *  11 ghost proposal, agent toggle, predict-before-run ........ this file
 *
 * Authority boundary: the canonical program hash is the only program authority.
 * AI proposals must not move it until the learner accepts; reject leaves it unchanged.
 */
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

const palette = (page: Page) => page.locator(".action-palette");
const tool = (page: Page, name: string) => palette(page).getByRole("button", { name, exact: true });
const code = (page: Page) => page.locator(".code-surface");
const run = (page: Page) =>
  page.locator(".stage-panel").getByRole("button", { name: "Run", exact: true });

async function openAppMenu(page: Page) {
  const menuButton = page.getByRole("button", { name: "Show app menu" });
  if (await menuButton.isVisible().catch(() => false)) {
    await menuButton.click();
  }
}

function appMenuButton(page: Page, name: string) {
  return page
    .locator("#app-menu")
    .getByRole("button", { name, exact: true })
    .or(page.getByTestId("play-controls").getByRole("button", { name, exact: true }))
    .first();
}

function appMenuControl(page: Page, name: string) {
  return page
    .locator("#app-menu")
    .getByRole("button", { name })
    .or(page.getByTestId("play-controls").getByRole("button", { name }))
    .first();
}

async function canonicalHash(page: Page) {
  return page.getByTestId("canonical-hash").getAttribute("data-canonical-hash");
}

async function setMove(page: Page, value: string) {
  const input = page.getByLabel("Move block").getByRole("spinbutton");
  await input.fill(value);
  await input.press("Enter");
}

async function dragHtml5(page: Page, sourceSelector: string, targetSelector: string) {
  await page.evaluate(
    ({ sourceSelector, targetSelector }) => {
      const source = document.querySelector(sourceSelector);
      const target = document.querySelector(targetSelector);
      if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) {
        throw new Error(`Missing drag target: ${sourceSelector} -> ${targetSelector}`);
      }
      const dataTransfer = new DataTransfer();
      source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer }));
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer }));
      target.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer }));
    },
    { sourceSelector, targetSelector },
  );
}

async function buildRepetitiveProgram(page: Page) {
  for (let i = 0; i < 3; i += 1) {
    await tool(page, "Move").click();
    await tool(page, "Turn").click();
  }
}

test("journey 1: palette drag, insert, inline edit and Run", async ({ page }) => {
  const empty = await canonicalHash(page);
  await dragHtml5(page, ".tool-motion_move", ".block-stack");
  await expect(page.getByLabel("Move block")).toBeVisible();
  const inserted = await canonicalHash(page);
  expect(inserted).not.toBe(empty);
  await expect(code(page)).toContainText("sprite.move(10);");

  await setMove(page, "160");
  await expect(code(page)).toContainText("sprite.move(160);");
  expect(await canonicalHash(page)).not.toBe(inserted);

  await run(page).click();
  await expect(page.getByText("Mission complete: your sprite reached the goal.")).toBeVisible({
    timeout: 5000,
  });
});

test("journey 2: reorder, nest, duplicate, delete, then Undo/Redo restore exact hashes", async ({
  page,
}) => {
  const hashes: (string | null)[] = [await canonicalHash(page)];
  const checkpoint = async () => hashes.push(await canonicalHash(page));

  await tool(page, "Move").click();
  await checkpoint();
  await tool(page, "Turn").click();
  await checkpoint();
  await tool(page, "Repeat").click();
  await checkpoint();

  // Reorder: Turn goes above Move.
  await page.getByLabel("Turn block").getByRole("button", { name: "Up", exact: true }).click();
  await checkpoint();
  expect(await page.locator(".block-stack .block-face").allInnerTexts()).toEqual([
    "Turn",
    "Move",
    "Repeat",
  ]);

  // Nest Move into the Repeat that follows it (move down first, then nest).
  await page.getByLabel("Move block").getByRole("button", { name: "Down", exact: true }).click();
  await checkpoint();
  await page.getByLabel("Move block").getByRole("button", { name: "Nest" }).click();
  await checkpoint();
  await expect(
    page.locator('[data-canonical-node-id="scripts[0]/statements[1]/body[0]"]'),
  ).toContainText("Move");

  // Duplicate the Turn, then delete the copy.
  await page.getByLabel("Turn block").getByRole("button", { name: "Duplicate" }).first().click();
  await checkpoint();
  await page.getByLabel("Turn block").first().getByRole("button", { name: "Delete" }).click();
  await checkpoint();

  // Undo all the way back, asserting every exact hash on the way.
  await openAppMenu(page);
  for (let i = hashes.length - 2; i >= 0; i -= 1) {
    await appMenuControl(page, "Undo program edit").click();
    expect(await canonicalHash(page), `undo to checkpoint ${i}`).toBe(hashes[i]);
  }
  // Redo all the way forward.
  for (let i = 1; i < hashes.length; i += 1) {
    await appMenuControl(page, "Redo program edit").click();
    expect(await canonicalHash(page), `redo to checkpoint ${i}`).toBe(hashes[i]);
  }
});

test("journeys 5+6: contextual AI proposal never moves the hash until accept; Undo/Redo exact", async ({
  page,
}) => {
  await buildRepetitiveProgram(page);
  const suggestion = page.getByTestId("repeat-suggestion");
  await expect(suggestion).toBeVisible();
  const before = await canonicalHash(page);

  // Offer visible and preview open: still just a proposal.
  await page.getByRole("button", { name: "Try it" }).click();
  await expect(page.getByTestId("proposal-preview")).toBeVisible();
  expect(await canonicalHash(page)).toBe(before);
  await expect(code(page)).not.toContainText("repeat");

  // Journey 5: reject leaves the hash and code unchanged.
  await suggestion.getByRole("button", { name: /Reject/ }).click();
  expect(await canonicalHash(page)).toBe(before);
  await expect(code(page)).not.toContainText("repeat");

  // Journey 6: a fresh offer, accept, Undo, Redo.
  await tool(page, "Move").click();
  const beforeAccept = await canonicalHash(page);
  expect(beforeAccept).not.toBe(before);
  await page.getByRole("button", { name: "Try it" }).click();
  expect(await canonicalHash(page)).toBe(beforeAccept);
  await suggestion.getByRole("button", { name: /Accept/ }).click();
  const accepted = await canonicalHash(page);
  expect(accepted).not.toBe(beforeAccept);
  await expect(code(page)).toContainText("repeat");

  await openAppMenu(page);
  await appMenuControl(page, "Undo program edit").click();
  expect(await canonicalHash(page)).toBe(beforeAccept);
  await expect(code(page)).not.toContainText("repeat");
  await appMenuControl(page, "Redo program edit").click();
  expect(await canonicalHash(page)).toBe(accepted);
  await expect(code(page)).toContainText("repeat");
});

test("journey 7: failed Run shows runtime evidence, hint does not mutate, learner corrects", async ({
  page,
}) => {
  await tool(page, "Move").click();
  await run(page).click();
  await expect(page.getByText("stopped short")).toBeVisible({ timeout: 5000 });
  await expect(page.getByLabel("Runtime result — actually happened").first()).toBeVisible();
  const failed = await canonicalHash(page);

  await page.getByRole("button", { name: "Use AI hint tool" }).click();
  await expect(page.getByText("Hint level 1 of 5").first()).toBeVisible();
  expect(await canonicalHash(page)).toBe(failed);

  await setMove(page, "160");
  expect(await canonicalHash(page)).not.toBe(failed);
  await run(page).click();
  await expect(page.getByText("Mission complete: your sprite reached the goal.")).toBeVisible({
    timeout: 5000,
  });
});

test("journey 8: Step keeps block, code and World synchronized without changing the program", async ({
  page,
}) => {
  await tool(page, "Move").click();
  await setMove(page, "160");
  const hash = await canonicalHash(page);
  const sprite = page.getByTestId("stage-sprite");
  const startX = await sprite.getAttribute("data-x");

  await openAppMenu(page);
  await appMenuButton(page, "Step").click();
  await expect(page.locator(".block-node.active")).toContainText("Move");
  await expect(page.getByTestId("stage-active-block")).toContainText("sprite.move(160);");
  await expect(page.getByTestId("stage-active-block")).toContainText("sprite.move(160);");
  await appMenuButton(page, "Step").click();
  await expect(sprite).not.toHaveAttribute("data-x", startX ?? "");
  expect(await canonicalHash(page)).toBe(hash);
});

test("journey 9: orientation changes never drift the program, even mid-Step", async ({ page }) => {
  await tool(page, "Move").click();
  await setMove(page, "160");
  await openAppMenu(page);
  await appMenuButton(page, "Step").click();
  const hash = await canonicalHash(page);
  for (const viewport of [
    { width: 820, height: 1180 },
    { width: 1180, height: 820 },
    { width: 820, height: 1180 },
  ]) {
    await page.setViewportSize(viewport);
    expect(await canonicalHash(page)).toBe(hash);
    await expect(code(page)).toContainText("sprite.move(160);");
    await expect(page.getByLabel("Move block").getByRole("spinbutton")).toHaveValue("160");
  }
});

test.describe("journey 10: AI unavailable", () => {
  test("core visual programming works offline with a failing AI bridge, no chat needed", async ({
    page,
    context,
  }) => {
    await page.addInitScript(() => {
      (globalThis as unknown as { agorixLaya: unknown }).agorixLaya = {
        decideMany: async () => {
          throw new Error("AI unavailable");
        },
      };
    });
    await page.goto("/");
    await context.setOffline(true);

    // Happy path never opens a chat or connects a provider.
    await tool(page, "Move").click();
    await setMove(page, "160");
    await tool(page, "Turn").click();
    await page.getByLabel("Turn block").getByRole("button", { name: "Up", exact: true }).click();
    await expect(code(page)).toContainText("sprite.move(160);");
    await page.getByLabel("Turn block").getByRole("button", { name: "Delete" }).click();
    await run(page).click();
    await expect(page.getByText("Mission complete: your sprite reached the goal.")).toBeVisible({
      timeout: 5000,
    });

    // Undo still works and the program never depended on AI.
    await openAppMenu(page);
    await appMenuControl(page, "Undo program edit").click();
    await expect(page.getByLabel("Turn block")).toBeVisible();
    await expect(page.getByRole("button", { name: "Keep local mode" })).toHaveCount(0);
  });

  test("a project executes with no provider configured", async ({ page }) => {
    await page.getByRole("button", { name: "Use AI explain tool" }).click();
    await page.getByRole("button", { name: "Connect AI" }).click();
    await expect(page.getByText("Not configured yet")).toBeVisible();
    await page.getByRole("button", { name: "Keep local mode" }).click();
    await tool(page, "Move").click();
    await setMove(page, "160");
    await run(page).click();
    await expect(page.getByText("Mission complete: your sprite reached the goal.")).toBeVisible({
      timeout: 5000,
    });
  });
});

test("journey 11: ghost proposal, agent toggle and prediction never move the hash", async ({
  page,
}) => {
  await buildRepetitiveProgram(page);
  const before = await canonicalHash(page);

  // Ghost preview: the proposal is visible in the program and the hash does not move.
  await page.getByRole("button", { name: "Try it" }).click();
  await expect(page.locator(".ghost-added, .ghost-removed, .ghost-changed").first()).toBeVisible();
  expect(await canonicalHash(page)).toBe(before);
  await page
    .getByTestId("repeat-suggestion")
    .getByRole("button", { name: /Reject/ })
    .click();
  await expect(page.locator(".ghost-added, .ghost-removed, .ghost-changed")).toHaveCount(0);
  expect(await canonicalHash(page)).toBe(before);

  // Agent off: offers and the intent dialogue go away, editing and Run still work.
  await page.getByRole("button", { name: "Use AI explain tool" }).click();
  await page.getByLabel("Agent helps").uncheck();
  await expect(page.getByTestId("repeat-suggestion")).toHaveCount(0);
  await tool(page, "Move").click();
  await run(page).click();
  await expect(page.getByTestId("canonical-hash")).toBeVisible();
  await page.getByLabel("Agent helps").check();

  // Prediction is optional and compared with the runtime result without touching the hash.
  const beforeRun = await canonicalHash(page);
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await run(page).click();
  await expect(page.getByTestId("prediction-comparison")).toContainText("runtime fact", {
    timeout: 15_000,
  });
  expect(await canonicalHash(page)).toBe(beforeRun);
});
