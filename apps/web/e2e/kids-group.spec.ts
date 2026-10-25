import { expect, test, type Browser, type Page } from "@playwright/test";

// Issue #566 and #567. Runs against the DEV/E2E-only in-process backend (AGORIX_DEV_BACKEND=1), which
// hosts the real project API, link service and group service. Separate browser contexts play the
// organizer's phone and each child's tablet.
test.use({ serviceWorkers: "block" });

const PASSWORD = "correct horse battery";
let counter = 0;
const alias = () =>
  `adult-${Date.now().toString(36)}-${++counter}-${Math.floor(Math.random() * 1e4)}`;

async function open(page: Page, flags: string[] = ["adultLink", "groupMode"]) {
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

// The dev mailbox keeps only the latest message of the whole server, and other spec files run in
// parallel, so wait for the one addressed to this test's own address.
async function mailToken(page: Page, to: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await page.request.get("/v1/__dev/mail");
    const body = (await response.json()) as { token?: string; to?: string };
    if (body.to === to && body.token !== undefined) return body.token;
    await page.waitForTimeout(250);
  }
  throw new Error("verification mail not found");
}

async function verifiedOrganizerAdults(page: Page) {
  await open(page);
  await openAdults(page);
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  const name = alias();
  const email = `${name}@example.com`;
  await page.getByLabel("Usuario").fill(name);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByLabel(/Tu correo/).fill(email);
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(page.getByText(`Sesión iniciada como ${name}`)).toBeVisible();
  await page.goto(`/kids?verify=${await mailToken(page, email)}`);
  await expect(page.getByRole("status").filter({ hasText: "Correo confirmado" })).toBeVisible();
  await openAdults(page);
}

async function codeFromOrganizer(page: Page, previous = ""): Promise<string> {
  await page.getByRole("button", { name: "Generar código de ingreso" }).click();
  const output = page.locator(".kids-link-code-value");
  // A new code replaces the old one; wait for the screen to show it.
  await expect(output).toHaveText(/^[A-Z2-9]{6}$/);
  if (previous !== "") await expect(output).not.toHaveText(previous);
  return (await output.innerText()).trim();
}

async function childJoins(browser: Browser, code: string): Promise<{ page: Page; alias: string }> {
  const tablet = await newPage(browser);
  await open(tablet);
  await openAdults(tablet);
  await tablet.getByLabel("Código de ingreso").fill(code);
  await tablet.getByRole("button", { name: "Unirme" }).click();
  await expect(tablet.getByText("Este dispositivo está en un grupo.")).toBeVisible();
  await expect(tablet.getByText("Esperando que el organizador lo apruebe…")).toBeVisible();
  const text = await tablet.getByText(/^Apodo: /).innerText();
  return { page: tablet, alias: text.replace("Apodo: ", "").trim() };
}

test("nothing appears while the flag is off, and no group endpoint is called", async ({ page }) => {
  const calls: string[] = [];
  page.on("request", (request) => {
    if (/\/v1\/group/.test(request.url())) calls.push(request.url());
  });
  await open(page, ["adultLink"]);
  await openAdults(page);
  await expect(page.getByRole("heading", { name: "Grupo en la misma sala" })).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(calls).toEqual([]);
});

test("organizer runs a group of two children and starts a team project", async ({
  page,
  browser,
}) => {
  await verifiedOrganizerAdults(page);
  await expect(page.getByRole("heading", { name: "Grupo en la misma sala" })).toBeVisible();
  await page.getByRole("button", { name: "Quiero organizar un grupo" }).click();
  await page.getByRole("button", { name: "Crear grupo" }).click();
  await expect(page.getByText("Grupo abierto")).toBeVisible();
  await expect(page.getByText("Aprobá al menos 2 niños")).toBeVisible();

  // First child joins and waits; a leaked code alone does not let them in.
  const code = await codeFromOrganizer(page);
  const first = await childJoins(browser, code);
  await expect(page.getByText("Espera tu aprobación")).toBeVisible({ timeout: 15_000 });
  await page.getByLabel(/Confirmo que el adulto responsable/).check();
  await page.getByRole("button", { name: "Aprobar", exact: true }).click();
  await expect(first.page.getByText("Listo para jugar en grupo.")).toBeVisible({ timeout: 15_000 });

  // The code was one-use.
  const reuse = await newPage(browser);
  await open(reuse);
  await openAdults(reuse);
  await reuse.getByLabel("Código de ingreso").fill(code);
  await reuse.getByRole("button", { name: "Unirme" }).click();
  await expect(reuse.getByText("Ese código no sirve o venció.")).toBeVisible();

  // Second child.
  const code2 = await codeFromOrganizer(page, code);
  const second = await childJoins(browser, code2);
  await expect(page.getByText("Espera tu aprobación")).toBeVisible({ timeout: 15_000 });
  await page.getByLabel(/Confirmo que el adulto responsable/).check();
  await page.getByRole("button", { name: "Aprobar", exact: true }).click();
  await expect(second.page.getByText("Listo para jugar en grupo.")).toBeVisible({
    timeout: 15_000,
  });

  // Team project.
  await expect(page.getByRole("heading", { name: "Proyecto del equipo" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Empezar el proyecto" }).click();
  await expect(page.getByText(/^Turno de /)).toBeVisible();
  await expect(page.getByText("Nada por decidir.")).toBeVisible();
  await expect(page.getByText("Todavía no hay cambios.")).toBeVisible();
  const key = await first.page.evaluate(() =>
    JSON.stringify({ ...localStorage, ...sessionStorage }),
  );
  expect(key).not.toMatch(/email|@example/i);

  // Closing the group makes the child devices forget it.
  await page.getByRole("button", { name: "Cerrar y borrar el grupo" }).click();
  await page.getByRole("button", { name: "Sí, borrar" }).click();
  await expect(first.page.getByLabel("Código de ingreso")).toBeVisible({ timeout: 15_000 });
});
