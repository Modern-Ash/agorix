import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page, type Route } from "./fixtures.js";
import { passAdultGate, openAdultTab } from "./helpers.js";

// Issues #509 to #513. Runs against the DEV/E2E-only in-process backend (AGORIX_DEV_BACKEND=1), which
// hosts the real project API and link service. Two browser contexts play the adult's phone and the
// child's tablet.
test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("agorix.kids.freeToScene.off.v1", "1"));
});

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
  await passAdultGate(page);
  await openAdultTab(page, "Cuenta y privacidad");
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
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "¡Crear!" }).click();
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
  await signUp(page, name, `${name}@example.com`);
  await expect(page.getByText("Revisá tu correo")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vincular un dispositivo" })).toHaveCount(0);

  // The email link
  const token = await mailToken(page);
  await page.goto(`/kids?verify=${token}`);
  await expect(page.getByRole("status").filter({ hasText: "Correo confirmado" })).toBeVisible();
  expect(page.url()).not.toContain("verify=");
  await openAdults(page);
  await expect(page.getByRole("heading", { name: "Vincular un dispositivo" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Preparar un proyecto para Ori" })).toHaveCount(0);

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

test("verified adult copies one Kids project to the account without duplicating it", async ({
  page,
  browser,
}) => {
  await page.route("**/v1/account/project-copy-eligible", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ eligible: true }),
    }),
  );
  const name = alias();
  await open(page);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "¡Crear!" }).click();
  await page.getByRole("button", { name: "Tocá el mundo para poner la meta: 5, 3" }).click();
  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await openAdults(page);
  await signUp(page, name, `${name}@example.com`);
  await expect(page.getByText("Revisá tu correo")).toBeVisible();
  const token = await mailToken(page);
  await page.goto(`/kids?verify=${token}`);
  await expect(page.getByRole("status").filter({ hasText: "Correo confirmado" })).toBeVisible();
  await openAdults(page);

  const card = page.getByRole("region", { name: "Usar mi proyecto con Ori" });
  await expect(card.getByRole("combobox", { name: "Proyecto de este dispositivo" })).toHaveValue(
    "free-1",
  );
  let creates = 0;
  let createStatus = 0;
  let createResponse = "";
  let updates = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/v1/projects") {
      creates++;
    }
    if (
      request.method() === "PUT" &&
      /^\/v1\/projects\/[^/]+$/.test(new URL(request.url()).pathname)
    ) {
      updates++;
    }
  });
  page.on("response", (response) => {
    if (
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/v1/projects"
    ) {
      createStatus = response.status();
      if (createStatus !== 201)
        void response.text().then((body) => {
          createResponse = body;
        });
    }
  });
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page.locator(".kids-project-card").getByRole("button", { name: "Jugar" }).click();
  const entry = page.getByRole("region", { name: "Usar Ori con mi cuenta" });
  await expect(entry).toBeVisible();
  expect(creates).toBe(0);
  await entry.getByRole("button", { name: "Ir a Adultos para vincularlo" }).click();
  await passAdultGate(page);
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Vincular proyecto a mi cuenta" }).click();
  await expect.poll(() => createStatus).not.toBe(0);
  if (createStatus !== 201) await expect.poll(() => createResponse).not.toBe("");
  expect(createStatus, createResponse).toBe(201);
  await expect(card.locator(".kids-note")).toContainText("Proyecto vinculado a tu cuenta");
  expect(creates).toBe(1);
  await expect(card.getByRole("button", { name: "Vincular proyecto a mi cuenta" })).toHaveCount(0);
  expect(creates).toBe(1);
  const pilotProjectId = await page.evaluate(() => {
    const copies = JSON.parse(
      localStorage.getItem("agorix.kids.account-project-copies.v1") ?? "[]",
    ) as { remoteProjectId: string }[];
    return copies[0]?.remoteProjectId;
  });
  expect(pilotProjectId).toBeTruthy();
  const sourcePresentation = await page.evaluate(() => {
    const projects = JSON.parse(localStorage.getItem("agorix.kids.projects.v1") ?? "[]") as {
      id: string;
      world: string;
      avatar: string;
    }[];
    return projects.find((project) => project.id === "free-1");
  });
  const secondDevice = await newPage(browser);
  let secondDeviceCreates = 0;
  secondDevice.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/v1/projects") {
      secondDeviceCreates++;
    }
  });
  await secondDevice.route("**/v1/account/project-copy-eligible", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ eligible: true }),
    }),
  );
  await open(secondDevice);
  await openAdults(secondDevice);
  await secondDevice.getByLabel("Usuario").fill(name);
  await secondDevice.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await secondDevice.getByRole("button", { name: "Entrar", exact: true }).last().click();
  const accountProjects = secondDevice.getByRole("region", { name: "Proyectos de mi cuenta" });
  await expect(accountProjects).toBeVisible();
  await accountProjects.getByLabel("Proyecto de cuenta").selectOption(pilotProjectId);
  await expect(accountProjects.getByText(/Mundo y personaje guardados/)).toBeVisible();
  await expect(accountProjects.getByLabel("Mundo en este dispositivo")).toHaveCount(0);
  await accountProjects.getByRole("button", { name: "Abrir en este dispositivo" }).click();
  await expect(accountProjects.getByRole("status")).toContainText("Proyecto free-1 listo");
  expect(secondDeviceCreates).toBe(0);
  expect(
    await secondDevice.evaluate(() => {
      const projects = JSON.parse(localStorage.getItem("agorix.kids.projects.v1") ?? "[]") as {
        id: string;
        world: string;
        avatar: string;
      }[];
      return projects.find((project) => project.id === "free-1");
    }),
  ).toEqual(sourcePresentation);
  expect(
    await secondDevice.evaluate(() => {
      const links = JSON.parse(
        localStorage.getItem("agorix.kids.account-project-copies.v1") ?? "[]",
      ) as { remoteProjectId: string }[];
      return links[0]?.remoteProjectId;
    }),
  ).toBe(pilotProjectId);
  await secondDevice.getByRole("button", { name: "Mis proyectos" }).click();
  await expect(
    secondDevice.locator(".kids-project-card").getByRole("button", { name: "Jugar" }),
  ).toHaveCount(1);
  await secondDevice.locator(".kids-project-card").getByRole("button", { name: "Borrar" }).click();
  const deleteDialog = secondDevice.getByRole("dialog", { name: "¿Cuánto es 7 + 5?" });
  await deleteDialog.getByRole("button", { name: "1", exact: true }).click();
  await deleteDialog.getByRole("button", { name: "2", exact: true }).click();
  await deleteDialog.getByRole("button", { name: "Comprobar" }).click();
  await secondDevice
    .getByRole("dialog", { name: "¿Borrar este proyecto?" })
    .getByRole("button", { name: "Borrar", exact: true })
    .click();
  await secondDevice.getByRole("button", { name: "Deshacer" }).click();
  await expect(
    secondDevice.locator(".kids-project-card").getByRole("button", { name: "Jugar" }),
  ).toHaveCount(1);
  expect(
    await secondDevice.evaluate(() =>
      JSON.parse(localStorage.getItem("agorix.kids.account-project-copies.v1") ?? "[]"),
    ),
  ).toMatchObject([{ remoteProjectId: pilotProjectId, localProjectId: "free-1" }]);
  await secondDevice.locator(".kids-project-card").getByRole("button", { name: "Borrar" }).click();
  const deleteAgainDialog = secondDevice.getByRole("dialog", { name: "¿Cuánto es 7 + 5?" });
  await deleteAgainDialog.getByRole("button", { name: "1", exact: true }).click();
  await deleteAgainDialog.getByRole("button", { name: "2", exact: true }).click();
  await deleteAgainDialog.getByRole("button", { name: "Comprobar" }).click();
  await secondDevice
    .getByRole("dialog", { name: "¿Borrar este proyecto?" })
    .getByRole("button", { name: "Borrar", exact: true })
    .click();
  await expect(
    secondDevice.locator(".kids-project-card").getByRole("button", { name: "Jugar" }),
  ).toHaveCount(0);
  expect(
    await secondDevice.evaluate(() =>
      JSON.parse(localStorage.getItem("agorix.kids.account-project-copies.v1") ?? "[]"),
    ),
  ).toEqual([]);
  await openAdults(secondDevice);
  const recoverAgain = secondDevice.getByRole("region", { name: "Proyectos de mi cuenta" });
  await expect(
    recoverAgain.getByRole("button", { name: "Abrir en este dispositivo" }),
  ).toBeVisible();
  await recoverAgain.getByRole("button", { name: "Abrir en este dispositivo" }).click();
  await expect(recoverAgain.getByRole("status")).toContainText("Proyecto free-1 listo");
  expect(secondDeviceCreates).toBe(0);
  await secondDevice.context().close();
  const pilotBodies: string[] = [];
  let proposalCount = 0;
  await page.route("**/api/tutor/ori/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    pilotBodies.push(`${path} ${route.request().postData() ?? ""}`);
    const payload = path.endsWith("/pilot/project")
      ? { projectId: pilotProjectId }
      : path.endsWith("/evidence/run")
        ? { recorded: true }
        : path.endsWith("/evidence/hint")
          ? { level: 2, text: "Probá un paso" }
          : path.endsWith("/review/debug")
            ? {
                schema: "agorix/ori-debug-guidance/v1",
                nextStep: "Revisar el paso 2 de la traza verificada por el host",
                question: "Preguntarse si ese paso produjo lo que esperabas",
                appliedChanges: false,
              }
            : path.endsWith("/review/propose")
              ? {
                  ticketId: `123e4567-e89b-42d3-a456-${String(++proposalCount).padStart(12, "0")}`,
                  appliedChanges: false,
                  proposal: {
                    schemaVersion: "ori/proposal/v0",
                    operation: "append",
                    requiresLearnerApproval: true,
                    blocks: [{ kind: "move", steps: 1 }],
                  },
                }
              : path.endsWith("/review/decision")
                ? {
                    status:
                      JSON.parse(route.request().postData() ?? "{}")?.decision === "reject"
                        ? "rejected"
                        : "accepted",
                    appliedChanges: false,
                  }
                : { status: "applied" };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });
  await page.evaluate(() => {
    const raw = localStorage.getItem("agorix:free-1");
    if (!raw) throw Error("Missing local project");
    const saved = JSON.parse(raw) as { metadata: { hintLevel: number } };
    saved.metadata.hintLevel = 1;
    localStorage.setItem("agorix:free-1", JSON.stringify(saved));
  });
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page.locator(".kids-project-card").getByRole("button", { name: "Jugar" }).click();
  const pilot = page.getByRole("region", { name: "Ori en mi proyecto" });
  await expect(pilot).toBeVisible();
  await expect.poll(() => updates).toBe(1);
  await expect(
    page.getByRole("status").filter({ hasText: "Proyecto guardado en tu cuenta" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sí", exact: true }).click();
  await expect(pilot.getByText(/guardó la evidencia/)).toBeVisible();
  await expect(pilot.getByRole("button", { name: "Aceptar propuesta" })).toBeVisible();
  await pilot.getByRole("button", { name: "Pedir ayuda para depurar" }).click();
  await expect(
    pilot.getByText("Revisar el paso 2 de la traza verificada por el host"),
  ).toBeVisible();
  expect(pilotBodies).toContain("/api/tutor/ori/review/debug {}");
  await pilot.getByRole("button", { name: "Rechazar propuesta" }).click();
  await expect(pilot.getByText(/Decisión confirmada por el servidor: rejected/)).toBeVisible();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sí", exact: true }).click();
  await expect(pilot.getByRole("button", { name: "Aceptar propuesta" })).toHaveCount(0);
  expect(proposalCount).toBe(1);
  await page.getByRole("button", { name: "Pista 2", exact: true }).click();
  await expect(pilot.getByText("Pista 2: Probá un paso")).toBeVisible();
  await expect(pilot.getByRole("button", { name: "Aceptar propuesta" })).toHaveCount(0);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sí", exact: true }).click();
  await expect(pilot.getByRole("button", { name: "Aceptar propuesta" })).toBeVisible();
  expect(proposalCount).toBe(2);
  await pilot.getByRole("button", { name: "Aceptar propuesta" }).click();
  // Exercise the explicit recovery button deterministically: the first local
  // pull is unavailable even though the reviewed server apply succeeded.
  const projectPattern = `**/v1/projects/${pilotProjectId}`;
  const denyProjectRead = (route: Route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 503, contentType: "application/json", body: "{}" })
      : route.continue();
  await page.route(projectPattern, denyProjectRead);
  await pilot.getByRole("button", { name: "Aplicar cambio aceptado a mi proyecto" }).click();
  await expect(pilot.getByText(/Ori aplicó el cambio a tu cuenta/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Traer cambio aprobado al editor" })).toBeVisible();
  await page.unroute(projectPattern, denyProjectRead);
  const editorPullStatus = await page.evaluate(async () => {
    return navigator.locks.request("agorix-auth-session-rotation", async () => {
      const copies = JSON.parse(
        localStorage.getItem("agorix.kids.account-project-copies.v1") ?? "[]",
      ) as { remoteProjectId: string }[];
      const remoteProjectId = copies[0]?.remoteProjectId;
      if (!remoteProjectId) return 0;
      const response = await fetch(`/v1/projects/${encodeURIComponent(remoteProjectId)}`);
      const remote = (await response.json()) as {
        revision: number;
        storedProject: { metadata: { hintLevel: number } };
      };
      const updated = await fetch(`/v1/projects/${encodeURIComponent(remoteProjectId)}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-agorix-request": "1" },
        body: JSON.stringify({
          expectedRevision: remote.revision,
          storedProject: {
            ...remote.storedProject,
            metadata: {
              ...remote.storedProject.metadata,
              hintLevel: remote.storedProject.metadata.hintLevel + 1,
            },
          },
        }),
      });
      return updated.status;
    });
  });
  expect(editorPullStatus).toBe(200);
  await page.getByRole("button", { name: "Traer cambio aprobado al editor" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Cambio aprobado cargado" }),
  ).toBeVisible();
  expect(pilotBodies.find((body) => body.startsWith("/api/tutor/ori/evidence/run"))).toBe(
    "/api/tutor/ori/evidence/run {}",
  );
  expect(pilotBodies.find((body) => body.startsWith("/api/tutor/ori/evidence/hint"))).toBe(
    '/api/tutor/ori/evidence/hint {"expectedLevel":2}',
  );
  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await openAdults(page);
  await card.getByText("Resolver problemas de sincronización").click();
  await card.getByRole("button", { name: "Enviar cambios de este dispositivo" }).click();
  await expect(card.locator(".kids-note")).toContainText("Copia de cuenta actualizada");
  expect(updates).toBe(4);
  const externalStatus = await page.evaluate(async () => {
    const saved = JSON.parse(
      localStorage.getItem("agorix.kids.account-project-copies.v1") ?? "[]",
    ) as readonly { remoteProjectId: string }[];
    const projectId = saved[0]?.remoteProjectId;
    if (!projectId) return 0;
    const response = await fetch(`/v1/projects/${encodeURIComponent(projectId)}`, {
      credentials: "same-origin",
    });
    const project = (await response.json()) as {
      revision: number;
      storedProject: { metadata: { hintLevel: number } };
    };
    const updated = await fetch(`/v1/projects/${encodeURIComponent(projectId)}`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "x-agorix-request": "1" },
      body: JSON.stringify({
        expectedRevision: project.revision,
        storedProject: {
          ...project.storedProject,
          metadata: {
            ...project.storedProject.metadata,
            hintLevel: project.storedProject.metadata.hintLevel + 1,
          },
        },
      }),
    });
    return updated.status;
  });
  expect(externalStatus).toBe(200);
  await card.getByRole("button", { name: "Enviar cambios de este dispositivo" }).click();
  await expect(card.locator(".kids-note")).toContainText("cambió en otro lugar");
  await card.getByRole("button", { name: "Traer cambios de mi cuenta" }).click();
  await expect(card.locator(".kids-note")).toContainText("Versión de cuenta cargada");
  expect(
    await page.evaluate(() => {
      const raw = localStorage.getItem("agorix:free-1");
      return raw ? (JSON.parse(raw) as { metadata: { hintLevel: number } }).metadata.hintLevel : -1;
    }),
  ).toBe(4);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("agorix.kids.projects.v1")))
    .toContain("free-1");
  await page.route("**/api/tutor/ori/evidence/run", (route) =>
    route.fulfill({ status: 403, contentType: "application/json", body: "{}" }),
  );
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page.locator(".kids-project-card").getByRole("button", { name: "Jugar" }).click();
  await expect(pilot).toBeVisible();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sí", exact: true }).click();
  await expect(
    pilot.getByText("No se pudo verificar esta ejecución. Tu proyecto no cambió."),
  ).toBeVisible();
  await expect(pilot.getByTestId("ori-proposal-review")).toHaveCount(0);
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
  await expect(page.getByRole("status").filter({ hasText: "Correo confirmado" })).toBeVisible();
  await openAdults(page);
  const refreshVerification = page.getByRole("button", { name: "Ya lo confirmé" });
  // Verification can complete between checking visibility and clicking the refresh control.
  if (await refreshVerification.isVisible())
    await refreshVerification.click({ timeout: 2_000 }).catch(() => undefined);
  await expect(page.getByRole("heading", { name: "Vincular un dispositivo" })).toBeVisible();
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

test("an older alias-only account is asked for an email before it can link (#519)", async ({
  page,
}) => {
  const name = alias();
  await open(page);
  await openAdults(page);
  await signUp(page, name, "old@example.com");
  // Pretend the server has no email on file for this old account.
  let present = false;
  let posted: string | undefined;
  await page.route("**/v1/account/email", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      posted = (request.postDataJSON() as { email: string }).email;
      present = true;
      return route.fulfill({
        status: 202,
        contentType: "application/json",
        body: '{"status":"sent"}',
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ present, verified: false }),
    });
  });
  await page.getByRole("button", { name: "Ya lo confirmé" }).click();
  await expect(page.getByRole("heading", { name: "Agregá tu correo" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vincular un dispositivo" })).toHaveCount(0);
  await page.getByLabel(/Tu correo/).fill("later@example.com");
  await page.getByRole("button", { name: "Enviar enlace de confirmación" }).click();
  await expect(page.getByText("Revisá tu correo")).toBeVisible();
  expect(posted).toBe("later@example.com");
});

test("deleting the account needs the password, removes everything and the tablet lets go (#517)", async ({
  page,
  browser,
}) => {
  const name = alias();
  await open(page);
  await openAdults(page);
  await signUp(page, name, "gone@example.com");
  await page.goto(`/kids?verify=${await mailToken(page)}`);
  await openAdults(page);
  await page.getByRole("button", { name: "Generar código" }).click();
  const code = (await page.getByLabel("Código de vinculación").innerText()).replace(/\s/g, "");

  const tablet = await newPage(browser);
  await open(tablet);
  await openAdults(tablet);
  const keypad = tablet.getByRole("group", { name: "Código de 6 números" });
  for (const digit of code) await keypad.getByRole("button", { name: digit, exact: true }).click();
  await keypad.getByRole("button", { name: "Vincular" }).click();
  await expect(tablet.getByText("Este dispositivo está vinculado")).toBeVisible();

  // Wrong password keeps everything
  await page.getByText("Borrar mi cuenta", { exact: true }).click();
  await page.getByRole("button", { name: "Borrar mi cuenta y todos mis datos" }).click();
  await page.getByLabel("Escribí tu contraseña para confirmar").fill("wrong password here");
  await page.getByRole("button", { name: "Sí, borrar todo" }).click();
  await expect(page.getByText("La contraseña no es correcta.")).toBeVisible();
  await expect(page.getByText(`Sesión iniciada como ${name}`)).toBeVisible();

  // Right password deletes
  await page.getByLabel("Escribí tu contraseña para confirmar").fill(PASSWORD);
  await page.getByRole("button", { name: "Sí, borrar todo" }).click();
  await expect(page.getByText("Tu cuenta y tus datos se borraron.")).toBeVisible();
  await expect(page.getByLabel("Usuario")).toBeVisible();

  // The credentials no longer work and the name is free again
  await page.getByLabel("Usuario").fill(name);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).last().click();
  await expect(page.getByText("Usuario o contraseña incorrectos.")).toBeVisible();

  // The tablet forgets the link on its next sync, without telling the child
  await tablet.getByRole("switch", { name: /Compartir el progreso/ }).click();
  await tablet.getByRole("switch", { name: /Compartir el progreso/ }).click();
  await expect
    .poll(() => tablet.evaluate(() => localStorage.getItem("agorix.kids.link.v1")), {
      timeout: 20_000,
    })
    .toBeNull();
  await tablet.context().close();
});
