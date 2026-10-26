import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { getKidsMission, kidsMoveSteps } from "@agorix/curriculum";
import { createProgramProposal } from "@agorix/proposals";
import { reloadToMap } from "./helpers.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

test("Ori chat stays scoped, private and clears when leaving the editor", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/tutor/chat", async (route) => {
    const input = route.request().postDataJSON() as { text: string };
    calls++;
    expect(input.text).toBe(calls === 1 ? "¿Cómo muevo los bloques?" : "¿Dónde está la meta?");
    if (calls === 2) return route.fulfill({ status: 503, body: "" });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message: "¿Cuántas casillas querés avanzar? Probá un bloque de mover.",
      }),
    });
  });
  await openEditor(page);
  await page.getByRole("button", { name: "Preguntale a Ori" }).click();
  await page.getByRole("textbox", { name: "Tu pregunta" }).fill("¿Cómo muevo los bloques?");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByRole("status").filter({ hasText: "casillas" })).toBeVisible();
  await page.getByRole("textbox", { name: "Tu pregunta" }).fill("¿Dónde está la meta?");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Ori no está disponible ahora" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain("¿Cómo muevo los bloques?");
  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await page.getByRole("button", { name: "Misión 1" }).click();
  await page.getByRole("button", { name: "Preguntale a Ori" }).click();
  await expect(page.getByRole("status").filter({ hasText: "casillas" })).toHaveCount(0);
});

async function openEditor(page: Page, locale: "es" | "en" = "es") {
  await page.goto("/kids");
  await page.evaluate((lang) => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", lang);
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  }, locale);
  await reloadToMap(page);
  await page.getByRole("button", { name: locale === "es" ? "Misión 1" : "Mission 1" }).click();
}

async function openOriProposal(page: Page) {
  await page.getByRole("button", { name: "Abrir propuesta de Ori" }).click();
  const proposal = page
    .getByRole("dialog", { name: "Propuesta de Ori" })
    .locator(".kids-ori-proposal");
  await expect(proposal).toBeVisible();
  return proposal;
}

test("builds, predicts, runs, steps and undoes on the real Kids mission", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  await page.getByRole("combobox", { name: "mover 1" }).selectOption("4");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".kids-run-status")).not.toContainText("Llegaste");
  await page.getByRole("dialog").getByRole("button", { name: "Sí", exact: true }).click();
  await expect(page.locator(".kids-run-status")).toContainText("Llegaste");
  await expect(page.locator(".kids-world-avatar")).toHaveText("🐸");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("agorix:kids.space.kids.m1.straight") ?? "null")?.metadata
            ?.missionProgress,
      ),
    )
    .toBe(1);
  await page.getByRole("button", { name: "Volver", exact: true }).click();
  await page.getByRole("button", { name: "Paso", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "No sé" }).click();
  await expect(page.locator(".kids-run-status")).toContainText("Llegaste");
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByRole("combobox", { name: "mover 1" })).toHaveValue("1");
  await page.getByRole("button", { name: "Rehacer" }).click();
  await expect(page.getByRole("combobox", { name: "mover 1" })).toHaveValue("4");
  await page.getByRole("button", { name: "Código", exact: true }).click();
  await page.getByRole("button", { name: "Más lenguajes" }).click();
  await page.getByRole("button", { name: "Python" }).click();
  await expect(page.locator(".kids-code-view")).toContainText("move(160)");
  await page.getByRole("button", { name: "Java", exact: true }).click();
  await expect(page.locator(".kids-code-view")).toContainText("move(160);");
  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await expect(page.locator(".kids-stars")).toHaveText("★1");
  await page.getByRole("button", { name: "Misión 1" }).click();
  await expect(page.getByRole("combobox", { name: "mover 1" })).toHaveValue("4");
});

test("records prediction and post-run revision from editor actions only", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("agorix.kids.reflections.v1")))
    .toBeNull();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sí", exact: true }).click();
  await page.getByRole("combobox", { name: "mover 1" }).selectOption("2");
  const events = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("agorix.kids.reflections.v1") ?? "[]"),
  );
  expect(events.map((event: { kind: string }) => event.kind)).toEqual([
    "predictionMade",
    "programRevisedAfterExecution",
  ]);
  expect(events[0]).toMatchObject({ prediction: "reachGoal", matchedRuntimeOutcome: false });
  expect(events[1]).toMatchObject({ changedNodeCount: 1, afterUnsuccessfulRun: true });
  expect(JSON.stringify(events)).not.toMatch(/timestamp|freeText|transcript/);
});

test("reveals hints in order and records only the levels opened", async ({ page }) => {
  await openEditor(page);
  await expect(page.getByRole("button", { name: "Ver idea" })).toHaveCount(0);
  for (let level = 1; level <= 4; level++) {
    await page.getByRole("button", { name: `Pista ${level}` }).click();
  }
  await page.getByRole("button", { name: "Ver idea" }).click();
  const events = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("agorix.kids.reflections.v1") ?? "[]"),
  );
  expect(events.map((event: { level: number }) => event.level)).toEqual([1, 2, 3, 4, 5]);
  expect(events.at(-1)).toMatchObject({ kind: "scaffoldDelivered", scaffoldKind: "solution" });
  await reloadToMap(page);
  await page.getByRole("button", { name: "Misión 1" }).click();
  await expect(page.locator(".kids-hints .kids-note")).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Ver idea" })).toHaveCount(0);
});

test("Ori offers a validated move, applies it only on Use, and Undo restores the program", async ({
  page,
}) => {
  await openEditor(page);
  const proposal = await openOriProposal(page);
  await expect(page.locator(".kids-program-block")).toHaveCount(0);
  await proposal.getByRole("button", { name: "Ver cambios" }).click();
  await expect(page.locator(".kids-ori-diff")).toContainText("move");
  await proposal.getByRole("button", { name: "Usar", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "mover 1" })).toHaveValue("4");
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(0);
  const events = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("agorix.kids.reflections.v1") ?? "[]"),
  );
  expect(events.at(-1)).toMatchObject({
    kind: "proposalDecided",
    decision: "accept",
    inspectedDiff: true,
  });
});

test("Ori shows a validated agent suggestion and leaves the program unchanged until Use", async ({
  page,
}) => {
  const mission = getKidsMission("kids.m1.straight", "es");
  const proposal = createProgramProposal({
    id: "ori-e2e-model",
    baseProgram: mission.starterProject,
    source: { kind: "learning-companion", capability: "builder" },
    purpose: "Una idea de Ori",
    rationale: "Mirá y decidí",
    affectedNodeIds: ["scripts[0]/statements[0]"],
    operations: [
      {
        type: "appendStatement",
        scriptIndex: 0,
        statement: { type: "move", steps: kidsMoveSteps(2) },
      },
    ],
  });
  await page.route("**/api/tutor/ori", async (route) => {
    const request = route.request().postDataJSON();
    expect(request).toMatchObject({ missionId: mission.id, locale: "es", hintLevel: 1 });
    await route.fulfill({ json: { message: "ignored", proposal } });
  });
  await openEditor(page);
  const proposalCard = await openOriProposal(page);
  await expect(proposalCard).toContainText("mover 2");
  await expect(page.locator(".kids-program-block")).toHaveCount(0);
  await proposalCard.getByRole("button", { name: "Usar", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "mover 1" })).toHaveValue("2");
  await expect(page.locator(".kids-editor")).not.toContainText(
    /conectad|proveedor|provider|offline/i,
  );
});

test("Ori silently uses local rules for an invalid or late agent answer", async ({ page }) => {
  const mission = getKidsMission("kids.m1.straight", "es");
  const proposal = createProgramProposal({
    id: "ori-e2e-stale",
    baseProgram: mission.starterProject,
    source: { kind: "learning-companion", capability: "builder" },
    purpose: "Una idea de Ori",
    rationale: "Mirá y decidí",
    affectedNodeIds: ["scripts[0]/statements[0]"],
    operations: [
      {
        type: "appendStatement",
        scriptIndex: 0,
        statement: { type: "move", steps: kidsMoveSteps(2) },
      },
    ],
  });
  await page.route("**/api/tutor/ori", (route) =>
    route.fulfill({
      json: { message: "ignored", proposal: { ...proposal, baseProgramHash: "stale" } },
    }),
  );
  await openEditor(page);
  await expect(await openOriProposal(page)).toContainText("mover 4");
  await page.unroute("**/api/tutor/ori");
  await page.route("**/api/tutor/ori", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 11_000));
    try {
      await route.fulfill({ json: { message: "ignored", proposal } });
    } catch {
      // The browser cancels the late request at the response budget.
    }
  });
  await reloadToMap(page);
  await page.getByRole("button", { name: "Misión 1" }).click();
  await expect(await openOriProposal(page)).toContainText("mover 4", { timeout: 13_000 });
  await expect(page.locator(".kids-editor")).not.toContainText(
    /conectad|proveedor|provider|offline/i,
  );
});

test("Ori's No leaves the program alone and repeated declines stop automatic offers", async ({
  page,
}) => {
  await openEditor(page);
  await (await openOriProposal(page)).getByRole("button", { name: "No, gracias" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(0);
  await (await openOriProposal(page)).getByRole("button", { name: "No, gracias" }).click();
  await reloadToMap(page);
  await page.getByRole("button", { name: "Misión 1" }).click();
  await expect(page.locator(".kids-ori-proposal")).toHaveCount(0);
  const events = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("agorix.kids.reflections.v1") ?? "[]"),
  );
  expect(events.filter((event: { decision?: string }) => event.decision === "reject")).toHaveLength(
    2,
  );
});

test("Ori's Change commits the child's chosen value", async ({ page }) => {
  await openEditor(page);
  const proposal = await openOriProposal(page);
  await proposal.getByRole("combobox").selectOption("3");
  await proposal.getByRole("button", { name: "Usar y cambiar" }).click();
  await expect(page.getByRole("combobox", { name: "mover 1" })).toHaveValue("3");
  const events = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("agorix.kids.reflections.v1") ?? "[]"),
  );
  expect(events.at(-1)).toMatchObject({ kind: "proposalDecided", decision: "modify" });
});

test("Ori speaks after an off-target run with no API connection", async ({ page }) => {
  await page.route("**/api/**", (route) => route.abort());
  await openEditor(page);
  await (await openOriProposal(page)).getByRole("button", { name: "No, gracias" }).click();
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sí", exact: true }).click();
  await expect(await openOriProposal(page)).toBeVisible();
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
});

test("shows wall evidence and has no serious accessibility violations", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  await page.getByRole("combobox", { name: "mover 1" }).selectOption("5");
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "No", exact: true }).click();
  await expect(page.locator(".kids-run-status")).toContainText("Chocó con el borde");
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(violations.map((violation) => violation.id)).toEqual([]);
});

test("palette works by keyboard and repeat executes its child blocks", async ({ page }) => {
  await openEditor(page, "en");
  const repeat = page.getByRole("button", { name: "+ repeat", exact: true });
  await repeat.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
  await page.locator(".kids-repeat-add").getByRole("button", { name: "+ move" }).click();
  await page.getByRole("combobox", { name: "move 1" }).last().selectOption("2");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Not sure" }).click();
  await expect(page.locator(".kids-run-status")).toContainText("reached");
  await expect(page.locator(".kids-program-block[data-active=true]")).toHaveCount(1);
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1180, height: 820 },
]) {
  test(`editor controls fit ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openEditor(page);
    const result = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const buttons = [...document.querySelectorAll<HTMLElement>(".kids-editor button")].filter(
        (button) => button.getBoundingClientRect().width > 0,
      );
      return buttons
        .filter((button) => {
          const rect = button.getBoundingClientRect();
          return rect.width < 44 || rect.height < 44 || rect.left < -1 || rect.right > width + 1;
        })
        .map((button) => button.textContent?.trim());
    });
    expect(result).toEqual([]);
  });
}
