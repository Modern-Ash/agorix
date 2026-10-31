import { expect, test, type Page } from "@playwright/test";
import { openAdultTab, passAdultGate } from "../helpers.js";

// Post-deploy smoke for the live site (issue #345). Read-only: it never signs in, never writes
// to the server, and only touches browser-local state inside throwaway contexts.

const expectedSha = process.env["AGORIX_EXPECT_SHA"];
const expectedAdultLink = process.env["AGORIX_EXPECT_ADULT_LINK"] === "1";

const REQUIRED_HEADERS = [
  "content-security-policy",
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
  "permissions-policy",
  "referrer-policy",
  "x-content-type-options",
  "x-frame-options",
] as const;

const palette = (page: Page) => page.locator(".action-palette");
const stageRun = (page: Page) =>
  page.locator(".stage-panel").getByRole("button", { name: /^(Run|Ejecutar)$/ });

async function openAppMenu(page: Page) {
  // /advanced loads the legacy editor as a lazy chunk; wait for it, or `isVisible()` below races it.
  await page.locator(".editor-shell").first().waitFor();
  const menuButton = page.getByRole("button", {
    name: /Show app menu|Hide app menu|Mostrar menú|Ocultar menú/,
  });
  await expect(menuButton).toBeVisible();
  if ((await menuButton.getAttribute("aria-expanded")) !== "true") await menuButton.click();
}

function trackProblems(page: Page, origin: string) {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    const text = message.text();
    const source = message.location().url;
    const expectedAnonymousSession =
      /^Failed to load resource: the server responded with a status of (401|404)\b/.test(text) &&
      source === `${origin}/v1/session`;
    if (message.type() === "error" && !expectedAnonymousSession) {
      problems.push(`console: ${text.slice(0, 120)}`);
    }
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith("http") && url.origin !== origin) {
      problems.push(`third-party request: ${url.origin}`);
    }
  });
  return problems;
}

test("serves the app shell over HTTPS with the full security header set", async ({
  request,
  baseURL,
}) => {
  expect(baseURL).toMatch(/^https:\/\//);
  const response = await request.get("/");
  expect(response.status()).toBe(200);
  const headers = response.headers();
  for (const name of REQUIRED_HEADERS) expect(headers[name], name).toBeTruthy();
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["cache-control"]).toContain("no-cache");

  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.headers()["content-type"]).toContain("application/manifest+json");
});

test("/version.json reports the deployed build", async ({ request }) => {
  const response = await request.get("/version.json");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { version: string; sha: string };
  expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
  expect(body.sha).toMatch(/^[0-9a-f]{12}$/);
  if (expectedSha !== undefined && expectedSha !== "") {
    expect(body.sha.startsWith(expectedSha)).toBe(true);
  }
});

test("project API discovery returns private JSON, never the app shell", async ({ request }) => {
  const response = await request.get("/v1/session");
  expect([401, 404]).toContain(response.status());
  expect(response.headers()["content-type"]).toContain("application/json");
  expect(response.headers()["cache-control"]).toContain("no-store");
  const body = (await response.json()) as { error?: { code?: string } };
  expect(["UNAUTHENTICATED", "NOT_FOUND"]).toContain(body.error?.code);
});

test("a first visit opens in Spanish, stays same-origin and registers the service worker", async ({
  page,
  baseURL,
}) => {
  const problems = trackProblems(page, new URL(baseURL!).origin);
  await page.goto("/");
  await expect(page.locator('script[src*="cloudflareinsights.com"]')).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("heading", { name: "¡Hola!" })).toBeVisible();
  await expect(page.locator(".kids-root")).toBeVisible();

  const registered = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.scriptURL ?? "";
  });
  expect(registered).toMatch(/\/sw\.js$/);
  expect(problems).toEqual([]);
});

test("the default Kids journey reaches the world map", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Seguir" }).click();
  await page.getByRole("button", { name: "Seguir" }).click();
  await page.getByRole("button", { name: "¡Empezar!" }).click();
  await expect(page.getByRole("heading", { name: "Mapa" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Misión 1" })).toBeVisible();
});

test("a returning browser sees the welcome screen at the base URL", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    ),
  );
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "¡Hola!" })).toBeVisible();
  await page.getByRole("button", { name: "Ir al mapa" }).click();
  await expect(page.getByRole("heading", { name: "Mapa" })).toBeVisible();
});

test("a fresh browser sees the creative Kids tools by default", async ({ page }) => {
  await page.goto("/");
  expect(await page.evaluate(() => localStorage.getItem("agorix.kids.flags.v1"))).toBeNull();
  await page.getByRole("button", { name: "Seguir" }).click();
  await page.getByRole("button", { name: "Seguir" }).click();
  await page.getByRole("button", { name: "¡Empezar!" }).click();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await expect(page.getByLabel("+ Explorador")).toBeVisible();
  await expect(page.getByLabel("+ Fondo")).toBeVisible();
  await expect(page.locator(".kids-root")).toHaveAttribute("data-block-palette", "scratch");
  await expect(page.locator(".kids-root")).toHaveAttribute("data-age-band", "6-8");
  await expect(page.getByRole("button", { name: "Hablar con Ori" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("agorix.kids.flags.v1"))).toBeNull();
});

test("a fresh browser reaches Escena libre with the whole palette, Lápiz and Música", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Seguir" }).click();
  await page.getByRole("button", { name: "Seguir" }).click();
  await page.getByRole("button", { name: "¡Empezar!" }).click();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  await expect(page).toHaveURL(/#\/escena\//);
  // Missions show 5 block kinds; the free scene must show the whole palette without flags set by hand.
  await expect.poll(() => page.locator("[data-kids-palette-tool]").count()).toBeGreaterThan(15);
  const categories = page.getByRole("navigation", { name: "Categorías de bloques" });
  for (const name of ["Movimiento", "Lápiz", "Música", "Variables y listas", "Mis bloques"]) {
    await expect(categories.getByRole("button", { name })).toBeVisible();
  }
  expect(await page.evaluate(() => localStorage.getItem("agorix.kids.flags.v1"))).toBeNull();
});

test("reviewed adult account build exposes account linking without group mode", async ({
  page,
}) => {
  test.skip(!expectedAdultLink, "Adult account linking is off for this deployment");
  await page.addInitScript(() =>
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    ),
  );
  await page.goto("/kids#/adultos");
  await passAdultGate(page);
  await openAdultTab(page, "Cuenta y privacidad");
  await expect(page.getByRole("heading", { name: "Mi cuenta de adulto" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Grupo en la misma sala" })).toHaveCount(0);
});

test("the parked editor still offers its local AI mode", async ({ page }) => {
  await page.goto("/advanced");
  await page
    .getByRole("button", { name: /explicar|explain/i })
    .first()
    .click();
  await expect(page.locator(".ai-coach-card").getByRole("status")).toBeVisible();
});

test("advanced First Mission: build, run and finish, then export", async ({ page, baseURL }) => {
  await page.addInitScript(() => localStorage.setItem("agorix.locale", "en"));
  const problems = trackProblems(page, new URL(baseURL!).origin);
  await page.goto("/advanced");

  await palette(page).getByRole("button", { name: "Move", exact: true }).click();
  const input = page.getByLabel("Move block").getByRole("spinbutton");
  await input.fill("160");
  await input.press("Enter");
  await expect(page.locator(".code-surface")).toContainText("sprite.move(160);");

  await stageRun(page).click();
  await expect(page.getByText("Mission complete: your sprite reached the goal.")).toBeVisible({
    timeout: 10_000,
  });

  const download = page.waitForEvent("download");
  await openAppMenu(page);
  await page.locator("#app-menu").getByRole("button", { name: "Export", exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.agorix$/);
  expect(problems).toEqual([]);
});

test("advanced Sound blocks run and show runtime evidence on the stage", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("agorix.locale", "en"));
  await page.goto("/advanced");
  await palette(page).getByLabel("Start sound", { exact: true }).click();
  await stageRun(page).click();
  await expect(page.locator(".stage-sounds")).toContainText("Sounds playing", { timeout: 10_000 });
});

test("the advanced language choice switches and survives a reload", async ({ page }) => {
  await page.goto("/advanced");
  await openAppMenu(page);
  await page.getByLabel(/Idioma del producto|Product language/).selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await openAppMenu(page);
  await page.getByLabel(/Idioma del producto|Product language/).selectOption("es");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
});

test.describe("Kids Ori production fallback", () => {
  test.use({ serviceWorkers: "block" });

  test("a child sees a reviewable local idea without provider wording", async ({ page }) => {
    await page.route("**/api/tutor/ori", (route) => route.fulfill({ status: 503, body: "" }));
    await page.addInitScript(() => {
      localStorage.setItem("agorix.locale", "es");
      localStorage.setItem(
        "agorix.kids.progress.v1",
        JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
      );
    });
    await page.goto("/kids#/mapa");
    await page.getByRole("button", { name: "Misión 1" }).click();
    // Ori keeps its idea back on entry: opening the second hint unlocks it (issue #590).
    await expect(page.getByRole("button", { name: "Abrir propuesta de Ori" })).toHaveCount(0);
    await page.getByRole("button", { name: "Pista 1", exact: true }).click();
    await page.getByRole("button", { name: "Pista 2", exact: true }).click();
    await page.getByRole("button", { name: "Abrir propuesta de Ori" }).click();
    await expect(page.locator(".kids-ori-proposal")).toContainText("mover 4");
    await expect(page.locator(".kids-editor")).not.toContainText(
      /conectad|proveedor|provider|offline/i,
    );
    await expect(page.locator(".kids-program-block")).toHaveCount(0);
  });
});
