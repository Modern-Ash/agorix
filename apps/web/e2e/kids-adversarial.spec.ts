import { expect, test, type Page } from "./fixtures.js";
import { KIDS_V2_FEATURES } from "../src/kids/kidsFlags.js";
import {
  reloadToMap,
  passAdultGate,
  BLOCKS_UNLOCKED,
  openAdultTab,
  addStudioBlock,
} from "./helpers.js";

// Issue #443: scripted slice of the adversarial charter, run with every v2 flag on.
// Any uncaught page error is a failure; each attack asserts the app still works afterwards.
test.use({ hasTouch: true, serviceWorkers: "block" });

const ALL_FLAGS = [...KIDS_V2_FEATURES];

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !/Failed to load resource/.test(message.text())) {
      errors.push(`console: ${message.text()}`);
    }
  });
  return errors;
}

async function seed(page: Page, flags: string[] = ALL_FLAGS) {
  await page.goto("/kids");
  await page.evaluate((list) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem("agorix.kids.flags.v1", JSON.stringify(list));
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  }, flags);
  await page.evaluate(
    (state) => localStorage.setItem("agorix.kids.mastery.v1", state),
    BLOCKS_UNLOCKED,
  );
  await reloadToMap(page);
}

async function openMission(page: Page) {
  await page.getByRole("button", { name: "Misión 1" }).click();
  await expect(page.getByRole("button", { name: "Jugar", exact: true })).toBeVisible();
}

const MOTION = (page: Page) =>
  page
    .getByRole("navigation", { name: "Categorías de bloques" })
    .getByRole("button", { name: "Movimiento" });
const ADD_MOVE = (page: Page) => page.getByRole("button", { name: "+ Mover", exact: true });
const RESULT = (page: Page) => page.getByTestId("scene-goal-result");

test("rapid taps: double Jugar, 60 palette taps and undo spam", async ({ page }) => {
  const errors = watchErrors(page);
  await seed(page);
  await openMission(page);
  await MOTION(page).click();
  const add = ADD_MOVE(page);
  for (let i = 0; i < 60; i++) await add.click({ noWaitAfter: true });
  await expect(page.locator(".kids-program-block").first()).toBeVisible();
  await page.getByRole("button", { name: "Jugar", exact: true }).dblclick();
  await expect(RESULT(page)).not.toBeEmpty();
  const undo = page.getByRole("button", { name: "Deshacer" });
  for (let i = 0; i < 80 && (await undo.isEnabled()); i++) await undo.click({ noWaitAfter: true });
  // History is bounded: undo stops there instead of failing, and redo walks back.
  await expect(undo).toBeDisabled();
  const kept = await page.locator(".kids-program-block").count();
  expect(kept).toBeLessThan(60);
  await page.getByRole("button", { name: "Rehacer" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(kept + 1);
  expect(errors).toEqual([]);
});

test("reload mid-run, then orientation and resize sweep", async ({ page }) => {
  const errors = watchErrors(page);
  await seed(page);
  await openMission(page);
  await addStudioBlock(page, "Movimiento", "+ Mover");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await reloadToMap(page);
  await expect(page.getByRole("heading", { name: "Mapa" })).toBeVisible();
  await openMission(page);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const width of [320, 480, 768, 1024, 1400]) {
    await page.setViewportSize({ width, height: 800 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(0);
  }
  await expect(page.getByRole("button", { name: "Jugar", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("odd programs: empty run and 40 blocks", async ({ page }) => {
  const errors = watchErrors(page);
  await seed(page);
  await openMission(page);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(RESULT(page)).not.toBeEmpty();
  await addStudioBlock(page, "Movimiento", "+ Girar a la izquierda", 40);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(RESULT(page)).not.toBeEmpty();
  expect(errors).toEqual([]);
});

test("Ori provider failures stay silent for the child", async ({ page }) => {
  const errors = watchErrors(page);
  const bodies = [
    { status: 500, body: "" },
    { status: 200, body: '{"proposal":' },
    {
      status: 200,
      body: JSON.stringify({
        proposal: { operations: [{ type: "appendStatement", statement: { type: "teleport" } }] },
      }),
    },
    { status: 200, body: "not json" },
  ];
  let call = 0;
  await page.route("**/api/tutor/**", (route) => {
    const next = bodies[call++ % bodies.length]!;
    return route.fulfill({ status: next.status, contentType: "application/json", body: next.body });
  });
  await seed(page);
  await openMission(page);
  for (let round = 0; round < 4; round++) {
    await addStudioBlock(page, "Movimiento", "+ Mover");
    await page.getByRole("button", { name: "Jugar", exact: true }).click();
    const show = page.getByRole("button", { name: "Mostrar ayuda de Ori" });
    if (await show.count()) await show.click();
    const help = page.getByRole("button", { name: "¿Qué bloque me ayuda?" });
    if (await help.count()) await help.click();
  }
  await expect(page.getByText(/no conectad|not connected|sin conexión con la IA/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Jugar", exact: true })).toBeEnabled();
  expect(errors).toEqual([]);
});

test("blocked storage: the session keeps working", async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => {
    const read = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      return key === "agorix.locale" ? "es" : read.call(this, key);
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("blocked", "SecurityError");
    };
  });
  await page.goto("/kids");
  await expect(page.getByRole("heading", { name: "¡Hola!" })).toBeVisible();
  await page.getByRole("button", { name: "Seguir" }).click();
  await page.getByRole("button", { name: "Seguir" }).click();
  await page.getByRole("button", { name: "¡Empezar!" }).click();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await expect(page.getByRole("button", { name: "Crear escena" })).toBeVisible();
  await page.getByRole("button", { name: "Mapa" }).click();
  await page.getByRole("button", { name: "Misión 1" }).click();
  // The mission is a saved scene: without storage it may open in memory or lead back, never crash.
  await expect(page.getByRole("button", { name: "Volver al mapa" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("adults gate: ten wrong sums never lock out or crash, the right sum still opens", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await seed(page);
  await page.getByRole("button", { name: "Adultos" }).click();
  for (let i = 0; i < 10; i++) {
    await page.getByRole("button", { name: "9", exact: true }).click();
    await page.getByRole("button", { name: "Comprobar" }).click();
  }
  await expect(page.getByText("Probá otra vez.")).toBeVisible();
  await passAdultGate(page);
  await expect(page.getByRole("tab", { name: "Resumen" })).toHaveAttribute("aria-selected", "true");
  expect(errors).toEqual([]);
});

test("keyboard only: the whole first mission can be played", async ({ page }) => {
  const errors = watchErrors(page);
  await seed(page);
  await page.getByRole("button", { name: "Misión 1" }).focus();
  await page.keyboard.press("Enter");
  await MOTION(page).focus();
  await page.keyboard.press("Enter");
  for (let i = 0; i < 4; i++) {
    await ADD_MOVE(page).focus();
    await page.keyboard.press("Enter");
  }
  await page.getByRole("button", { name: "Jugar", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(RESULT(page)).toContainText("Lograste la meta");
  expect(errors).toEqual([]);
});

test("a full or blocked storage cannot crash the adult images panel", async ({ page }) => {
  const errors = watchErrors(page);
  await seed(page);
  await page.getByRole("button", { name: "Adultos" }).click();
  await passAdultGate(page);
  await openAdultTab(page, "Personalizar");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
  });
  const file = {
    name: "pixel.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  };
  const inputs = page.locator('input[type="file"]');
  if ((await inputs.count()) > 0) await inputs.first().setInputFiles(file);
  await expect(page.getByRole("tablist", { name: "Secciones de Adultos" })).toBeVisible();
  expect(errors).toEqual([]);
});
