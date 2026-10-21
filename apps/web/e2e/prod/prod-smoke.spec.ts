import { expect, test, type Page } from "@playwright/test";

// Post-deploy smoke for the live site (issue #345). Read-only: it never signs in, never writes
// to the server, and only touches browser-local state inside throwaway contexts.

const expectedSha = process.env["AGORIX_EXPECT_SHA"];

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
  const menuButton = page.getByRole("button", { name: "Show app menu" });
  if (await menuButton.isVisible().catch(() => false)) await menuButton.click();
}

// Cloudflare auto-injects its Web Analytics beacon into HTML for browsers; our CSP blocks it.
// Known and tracked (disable it in the Cloudflare dashboard); everything else must stay clean.
const KNOWN_EDGE_INJECTION = "cloudflareinsights.com";

function trackProblems(page: Page, origin: string) {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.includes(KNOWN_EDGE_INJECTION)) {
      problems.push(`console: ${text.slice(0, 120)}`);
    }
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.protocol.startsWith("http") &&
      url.origin !== origin &&
      !url.hostname.endsWith(KNOWN_EDGE_INJECTION)
    ) {
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

test("a first visit opens in Spanish, stays same-origin and registers the service worker", async ({
  page,
  baseURL,
}) => {
  const problems = trackProblems(page, new URL(baseURL!).origin);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByText("Misión: Lleva tu personaje hasta la meta.")).toBeVisible();

  const registered = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.scriptURL ?? "";
  });
  expect(registered).toMatch(/\/sw\.js$/);
  expect(problems).toEqual([]);
});

test("without a server AI the card says local mode", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: /explicar|explain/i })
    .first()
    .click();
  await expect(page.locator(".ai-coach-card").getByRole("status")).toBeVisible();
});

test("First Mission: build, run and finish, then export the project", async ({ page, baseURL }) => {
  await page.addInitScript(() => localStorage.setItem("agorix.locale", "en"));
  const problems = trackProblems(page, new URL(baseURL!).origin);
  await page.goto("/");

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

test("Sound blocks run and show runtime evidence on the stage", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("agorix.locale", "en"));
  await page.goto("/");
  await palette(page).getByLabel("Start sound", { exact: true }).click();
  await stageRun(page).click();
  await expect(page.locator(".stage-sounds")).toContainText("Sounds playing", { timeout: 10_000 });
});

test("the language choice switches and survives a reload", async ({ page }) => {
  await page.goto("/");
  await openAppMenu(page);
  await page.getByLabel(/Idioma del producto|Product language/).selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await openAppMenu(page);
  await page.getByLabel(/Idioma del producto|Product language/).selectOption("es");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
});
