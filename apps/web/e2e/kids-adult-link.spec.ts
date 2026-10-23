import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

// Issues #509 to #513. Runs against the DEV/E2E-only in-process backend (AGORIX_DEV_BACKEND=1), which
// hosts the real project API and link service. Two browser contexts play the adult's phone and the
// child's tablet.
test.use({ serviceWorkers: "block" });

const PASSWORD = "correct horse battery";
let counter = 0;
const alias = () =>
  `adult-${Date.now().toString(36)}-${++counter}-${Math.floor(Math.random() * 1e4)}`;

async function open(page: Page, flags: string[] = ["adultLink"]) {
  await page.goto("/kids");
  await page.evaluate((list) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem("agorix.kids.flags.v1", JSON.stringify(list));
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: { "space:0": true } }),
    );
  }, flags);
  await page.reload();
}

async function openAdults(page: Page) {
  await page.getByRole("button", { name: "Adultos" }).click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "2", exact: true }).click();
  await page.getByRole("button", { name: "Comprobar" }).click();
  await expect(page.getByRole("heading", { name: "Ajustes" })).toBeVisible();
}

async function newPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4173").origin,
          localStorage: [{ name: "agorix.locale", value: "es" }],
        },
      ],
    },
    serviceWorkers: "block",
  });
  return context.newPage();
}

async function mailToken(page: Page): Promise<string> {
  const response = await page.request.get("/v1/__dev/mail");
  return ((await response.json()) as { token: string }).token;
}

async function signUp(page: Page, name: string, email: string) {
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await page.getByLabel("Usuario").fill(name);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByLabel(/Tu correo/).fill(email);
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(page.getByText(`Sesión iniciada como ${name}`)).toBeVisible();
}

test("nothing appears while the flag is off, and no link endpoint is called", async ({ page }) => {
  const calls: string[] = [];
  page.on("request", (request) => {
    if (/\/v1\/(link|account)/.test(request.url())) calls.push(request.url());
  });
  await open(page, []);
  await openAdults(page);
  await expect(page.getByRole("heading", { name: "Cuenta de adulto y vinculación" })).toHaveCount(
    0,
  );
  await page.waitForTimeout(300);
  expect(calls).toEqual([]);
});

test("a never-linked child device makes no link request even with the flag on", async ({
  page,
}) => {
  const calls: string[] = [];
  page.on("request", (request) => {
    if (/\/v1\/link\//.test(request.url())) calls.push(request.url());
  });
  await open(page);
  await page.getByRole("button", { name: "Misión 1" }).click();
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  await page.waitForTimeout(300);
  expect(calls).toEqual([]);
});

test("adult signs up, verifies by email, links a child tablet, sees its summary and unlinks", async ({
  page,
  browser,
}) => {
  const name = alias();
  // Adult phone
  await open(page);
  await openAdults(page);
  await expect(page.getByRole("heading", { name: "Cuenta de adulto y vinculación" })).toBeVisible();
  await signUp(page, name, "ada@example.com");
  await expect(page.getByText("Revisá tu correo")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vincular un dispositivo" })).toHaveCount(0);

  // The email link
  const token = await mailToken(page);
  await page.goto(`/kids?verify=${token}`);
  await expect(page.getByRole("status").filter({ hasText: "Correo confirmado" })).toBeVisible();
  expect(page.url()).not.toContain("verify=");
  await openAdults(page);
  await expect(page.getByRole("heading", { name: "Vincular un dispositivo" })).toBeVisible();

  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);

  await page.getByRole("button", { name: "Generar código" }).click();
  const codeText = (await page.getByLabel("Código de vinculación").innerText()).replace(/\s/g, "");
  expect(codeText).toMatch(/^\d{6}$/);
  await expect(page.getByText(/Vence en \d\d:\d\d/)).toBeVisible();
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(stored).not.toContain(codeText);
  expect(page.url()).not.toContain(codeText);

  // Child tablet
  const tablet = await newPage(browser);
  await open(tablet);
  await openAdults(tablet);
  await expect(tablet.getByRole("heading", { name: "Este dispositivo" })).toBeVisible();
  const keypad = tablet.getByRole("group", { name: "Código de 6 números" });
  for (const digit of "000000".slice(0, 0) + codeText) {
    await keypad.getByRole("button", { name: digit, exact: true }).click();
  }
  await keypad.getByRole("button", { name: "Vincular" }).click();
  await expect(tablet.getByText("Este dispositivo está vinculado")).toBeVisible();
  const linkKey = await tablet.evaluate(() => localStorage.getItem("agorix.kids.link.v1"));
  expect(linkKey).toContain('"sharing":true');
  expect(linkKey).not.toMatch(/email|alias|account/i);

  // The adult's phone notices the new device without a reload
  await expect(page.getByText("¡Dispositivo vinculado!")).toBeVisible({ timeout: 15_000 });

  // The tablet's first sync reaches the adult
  await expect(page.getByText("Misiones completadas: 1")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Conceptos practicados: 1 · 0 · 0/)).toBeVisible();

  // Stop sharing on the device: the adult's view stops changing; sharing flag is kept locally
  await tablet.getByRole("switch", { name: /Compartir el progreso/ }).click();
  await expect
    .poll(() => tablet.evaluate(() => localStorage.getItem("agorix.kids.link.v1")))
    .toContain('"sharing":false');

  // The adult unlinks
  await page.getByRole("button", { name: "Desvincular 1" }).click();
  await page.getByRole("button", { name: "Sí, desvincular" }).click();
  await expect(page.getByText(/Desvinculado\. Se borra el/)).toBeVisible();
  await expect(page.getByText(/30 días y después se borra/)).toBeVisible();

  // The tablet notices on its next sync and forgets the link without telling the child
  await tablet.getByRole("switch", { name: /Compartir el progreso/ }).click();
  await expect
    .poll(() => tablet.evaluate(() => localStorage.getItem("agorix.kids.link.v1")), {
      timeout: 20_000,
    })
    .toBeNull();
  await tablet.context().close();
});

test("the child's wrong code reads as a calm, generic message", async ({ page }) => {
  await open(page);
  await openAdults(page);
  const keypad = page.getByRole("group", { name: "Código de 6 números" });
  for (const digit of "000000")
    await keypad.getByRole("button", { name: digit, exact: true }).click();
  await keypad.getByRole("button", { name: "Vincular" }).click();
  await expect(page.getByText("Ese código no sirvió. Pedí uno nuevo.")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("agorix.kids.link.v1"))).toBeNull();
});

test("wrong password, taken username and an unverified email are all explained without leaks", async ({
  page,
}) => {
  const name = alias();
  await open(page);
  await openAdults(page);
  await signUp(page, name, "bob@example.com");
  await page.getByRole("button", { name: "Salir", exact: true }).click();

  await page.getByLabel("Usuario").fill(name);
  await page.getByLabel("Contraseña", { exact: true }).fill("wrong password here");
  await page.getByRole("button", { name: "Entrar", exact: true }).last().click();
  await expect(page.getByText("Usuario o contraseña incorrectos.")).toBeVisible();

  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await page.getByLabel("Usuario").fill(name);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByLabel(/Tu correo/).fill("other@example.com");
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(page.getByText("Ese usuario no está disponible.")).toBeVisible();
});

test("a bad verification link says so and does not break the app", async ({ page }) => {
  await open(page);
  await page.goto("/kids?verify=not-a-real-token");
  await expect(page.getByRole("status").filter({ hasText: "Ese enlace no sirve" })).toBeVisible();
  expect(page.url()).not.toContain("verify=");
  await expect(page.getByRole("heading", { name: "Mapa" })).toBeVisible();
});

test("the panel is simply absent where the server has no link service", async ({ page }) => {
  await page.route("**/v1/account/email", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "NOT_FOUND", message: "Not found", retryable: false },
      }),
    }),
  );
  await open(page);
  await openAdults(page);
  await expect(page.getByRole("heading", { name: "Ajustes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cuenta de adulto y vinculación" })).toHaveCount(
    0,
  );
});

test("a throttled device reads the same calm message and keeps working", async ({ page }) => {
  await page.route("**/v1/link/redeem", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "RATE_LIMITED", message: "Too many attempts", retryable: true },
      }),
    }),
  );
  await open(page);
  await openAdults(page);
  const keypad = page.getByRole("group", { name: "Código de 6 números" });
  for (const digit of "123456")
    await keypad.getByRole("button", { name: digit, exact: true }).click();
  await keypad.getByRole("button", { name: "Vincular" }).click();
  await expect(page.getByText("Demasiados intentos. Esperá un rato.")).toBeVisible();
  await expect(keypad.getByRole("button", { name: "Vincular" })).toBeEnabled();
});

test("offline while redeeming explains it and does not link", async ({ page }) => {
  await page.route("**/v1/link/redeem", (route) => route.abort("internetdisconnected"));
  await open(page);
  await openAdults(page);
  const keypad = page.getByRole("group", { name: "Código de 6 números" });
  for (const digit of "123456")
    await keypad.getByRole("button", { name: digit, exact: true }).click();
  await keypad.getByRole("button", { name: "Vincular" }).click();
  await expect(page.getByText("No hay conexión. Probá de nuevo más tarde.")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("agorix.kids.link.v1"))).toBeNull();
});

test("when the browser cannot keep the link, the device releases it at once", async ({ page }) => {
  const calls: string[] = [];
  await page.route("**/v1/link/redeem", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        deviceToken: "abcdefghijklmnopqrstuvwxyz0123456789_-AB",
        expiresAt: "2027-01-01T00:00:00.000Z",
      }),
    }),
  );
  await page.route("**/v1/link/self", (route) => {
    calls.push(route.request().method());
    return route.fulfill({ status: 204 });
  });
  await open(page);
  await openAdults(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === "agorix.kids.link.v1") throw new DOMException("blocked", "SecurityError");
      return original.call(this, key, value);
    };
  });
  const keypad = page.getByRole("group", { name: "Código de 6 números" });
  for (const digit of "123456")
    await keypad.getByRole("button", { name: digit, exact: true }).click();
  await keypad.getByRole("button", { name: "Vincular" }).click();
  await expect(page.getByText("Este navegador no puede guardar la vinculación")).toBeVisible();
  expect(calls).toEqual(["DELETE"]);
});

test("Ori requests from a linked device never carry link data", async ({ page, browser }) => {
  const name = alias();
  await open(page);
  await openAdults(page);
  await signUp(page, name, "ori.check@example.com");
  await page.goto(`/kids?verify=${await mailToken(page)}`);
  await openAdults(page);
  await page.getByRole("button", { name: "Generar código" }).click();
  const code = (await page.getByLabel("Código de vinculación").innerText()).replace(/\s/g, "");

  const tablet = await newPage(browser);
  const tutorBodies: string[] = [];
  await tablet.route("**/api/tutor/**", async (route) => {
    tutorBodies.push(route.request().postData() ?? "");
    await route.fulfill({ status: 503, body: "" });
  });
  await open(tablet);
  await openAdults(tablet);
  const keypad = tablet.getByRole("group", { name: "Código de 6 números" });
  for (const digit of code) await keypad.getByRole("button", { name: digit, exact: true }).click();
  await keypad.getByRole("button", { name: "Vincular" }).click();
  await expect(tablet.getByText("Este dispositivo está vinculado")).toBeVisible();
  const token = JSON.parse(
    (await tablet.evaluate(() => localStorage.getItem("agorix.kids.link.v1"))) ?? "{}",
  ).token as string;

  await tablet.getByRole("button", { name: "Mapa" }).click();
  await tablet.getByRole("button", { name: "Misión 1" }).click();
  await tablet.getByRole("button", { name: "+ mover", exact: true }).click();
  await tablet.getByRole("button", { name: "Jugar", exact: true }).click();
  await tablet.getByRole("dialog").getByRole("button", { name: "No", exact: true }).click();
  await tablet.getByRole("button", { name: "Preguntale a Ori" }).click();
  await tablet.getByRole("textbox", { name: "Tu pregunta" }).fill("hola");
  await tablet.getByRole("button", { name: "Enviar" }).click();
  await tablet.waitForTimeout(500);

  const sent = tutorBodies.join("\n");
  expect(tutorBodies.length).toBeGreaterThan(0);
  expect(sent).not.toContain(token);
  expect(sent).not.toMatch(
    /example\.com|agorix\.kids\.link|deviceToken|linkId|ageBand|authorization/i,
  );
  await tablet.context().close();
});
