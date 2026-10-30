import { expect, test } from "@playwright/test";

test("AI operations console validates, publishes and restores a revision", async ({ page }) => {
  const capabilities = Object.fromEntries(
    ["mission", "advanced", "studio", "chat", "goals", "legacy"].map((key) => [
      key,
      {
        enabled: true,
        provider: key === "legacy" ? "fake" : "auto",
        model: "gpt-6-luna",
        timeoutMs: 7000,
        requestsPerMinute: 6,
        promptTemplate: "",
        fallback: "deterministic",
      },
    ]),
  );
  const initial = { schema: "agorix/ai-config/v1", capabilities };
  let config = structuredClone(initial);
  let revision = 1;
  const history = [
    {
      revision,
      author: "system",
      createdAt: new Date().toISOString(),
      action: "seed",
      sourceRevision: null,
    },
  ];
  await page.route("**/api/tutor/admin/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.split("/").at(-1);
    if (path === "session" && request.method() === "GET")
      return route.fulfill({ status: 401, json: { error: { code: "unauthorized" } } });
    if (path === "session" && request.method() === "POST")
      return route.fulfill({ json: { csrf: "csrf", author: "operator" } });
    if (path === "config")
      return route.fulfill({ json: { current: { ...history[0], config, revision }, history } });
    if (path === "preview")
      return route.fulfill({
        json: { valid: true, changed: ["mission"], expectedRevision: revision },
      });
    if (path === "publish") {
      config = request.postDataJSON().config;
      revision++;
      history.unshift({
        revision,
        author: "operator",
        createdAt: new Date().toISOString(),
        action: "publish",
        sourceRevision: null,
      });
      return route.fulfill({ json: { current: { ...history[0], config } } });
    }
    if (path === "rollback") {
      config = structuredClone(initial);
      revision++;
      history.unshift({
        revision,
        author: "operator",
        createdAt: new Date().toISOString(),
        action: "rollback",
        sourceRevision: 1,
      });
      return route.fulfill({ json: { current: { ...history[0], config } } });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto("/admin/ai");
  await expect(page.getByRole("heading", { name: "Centro de IA" })).toBeVisible();
  await page.getByLabel("Clave de administración").fill("a-strong-admin-password");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: "Ori en misiones" })).toBeVisible();
  // Issue #1112: the menu is grouped and monitoring lives apart from the sections that edit.
  const menu = page.getByRole("navigation", { name: "Centro de IA" });
  for (const group of ["REGLAS", "AGENTES DE ORI", "MONITOREO"])
    await expect(menu.getByRole("group", { name: group })).toBeVisible();
  await expect(menu.getByRole("button", { name: /Ori en misiones/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("button", { name: "Restaurar" })).toHaveCount(0);
  const draftBar = page.getByRole("region", { name: "Borrador" });
  await expect(draftBar).toContainText("Sin cambios pendientes");
  await page.getByLabel("Instrucción adicional").fill("Preguntá qué predice el estudiante.");
  await expect(draftBar).toContainText("1 sección cambiada sin publicar");
  await expect(draftBar).toContainText("Ori en misiones");
  await expect(page.getByRole("button", { name: "Publicar revisión" })).toBeDisabled();
  await page.getByRole("button", { name: "Validar cambios" }).click();
  await expect(draftBar).toContainText("Validado: 1 sección cambiada, lista para publicar");
  await page.getByRole("button", { name: "Publicar revisión" }).click();
  await expect(page.getByText("Configuración publicada.")).toBeVisible();
  await expect(draftBar).toContainText("Sin cambios pendientes");
  page.on("dialog", (dialog) => void dialog.accept());
  await menu.getByRole("button", { name: /Historial y monitoreo/ }).click();
  await expect(page.getByRole("heading", { name: "Historial y monitoreo" })).toBeVisible();
  await page.getByRole("button", { name: "Restaurar" }).last().click();
  await expect(page.getByText("Revisión 1 restaurada.")).toBeVisible();
  await menu.getByRole("button", { name: /Ori en misiones/ }).click();
  await expect(page.getByLabel("Instrucción adicional")).toHaveValue("");

  // On a phone the grouped menu wraps instead of scrolling sideways, and the draft bar stays in view.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Instrucción adicional").fill("Otra idea.");
  const layout = await page.evaluate(() => {
    const bar = document.querySelector(".ai-admin-draft")!.getBoundingClientRect();
    return {
      sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      barInView: bar.bottom <= window.innerHeight + 1 && bar.top < window.innerHeight,
    };
  });
  expect(layout).toEqual({ sideways: false, barInView: true });
});

test("AI operations console edits the group settings and cannot weaken the fail-closed rule", async ({
  page,
}) => {
  const policy = {
    enabled: true,
    provider: "auto",
    model: "gpt-6-luna",
    timeoutMs: 7000,
    requestsPerMinute: 6,
    promptTemplate: "",
    fallback: "deterministic",
  };
  const capabilities = Object.fromEntries(
    ["mission", "advanced", "studio", "chat", "goals", "legacy"].map((key) => [
      key,
      { ...policy, provider: key === "legacy" ? "fake" : "auto" },
    ]),
  );
  const group = {
    moderation: {
      image: {
        enabled: true,
        modelId: "local-image-classifier",
        unsafeThreshold: 0.5,
        uncertainThreshold: 0.2,
        blockedCategories: ["violence", "sexual", "hate", "self-harm", "personal-data", "other"],
        onUnavailable: "block",
      },
      text: {
        enabled: true,
        ruleSet: "local-text-rules",
        blockedTerms: { es: [], en: [] },
        piiPatterns: ["phone", "email", "address", "url"],
        onUnavailable: "block",
      },
    },
    approvalQueue: { holdAll: true, reasonRetentionMinutes: 10 },
    reactions: { es: ["like", "party", "think", "heart"], en: ["like", "party", "think", "heart"] },
    limits: { maxChildren: 4, maxSessionMinutes: 120, joinCodeMinutes: 10, relayEnabled: false },
  };
  const config = { schema: "agorix/ai-config/v2", capabilities, group };
  let published: { group: typeof group } | undefined;
  const history = [
    {
      revision: 1,
      author: "system",
      createdAt: new Date().toISOString(),
      action: "seed",
      sourceRevision: null,
    },
  ];
  await page.route("**/api/tutor/admin/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.split("/").at(-1);
    if (path === "session" && request.method() === "GET")
      return route.fulfill({ status: 401, json: { error: { code: "unauthorized" } } });
    if (path === "session" && request.method() === "POST")
      return route.fulfill({ json: { csrf: "csrf", author: "operator" } });
    if (path === "config")
      return route.fulfill({
        json: { current: { ...history[0], config: published ?? config, revision: 1 }, history },
      });
    if (path === "preview")
      return route.fulfill({ json: { valid: true, changed: ["group"], expectedRevision: 1 } });
    if (path === "publish") {
      published = request.postDataJSON().config;
      return route.fulfill({ json: { current: { ...history[0], config: published } } });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto("/admin/ai");
  await page.getByLabel("Clave de administración").fill("a-strong-admin-password");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.getByRole("button", { name: /Modo grupo/ }).click();
  await expect(page.getByRole("heading", { name: "Modo grupo" })).toBeVisible();
  await expect(page.getByText(/esa regla no se puede desactivar/)).toBeVisible();
  // There is no control for the fail-closed rule, and the relay starts off.
  await expect(page.getByLabel(/servicio de apoyo de conexión/)).not.toBeChecked();

  await page.getByLabel(/Niños por grupo/).fill("3");
  await page.getByLabel(/Términos bloqueados \(es\)/).fill("tonto\n\ntonta ");
  await page.getByLabel(/El organizador aprueba todo/).uncheck();
  await page.getByRole("button", { name: "Validar cambios" }).click();
  await expect(page.getByText("Impacta: Modo grupo")).toBeVisible();
  await page.getByRole("button", { name: "Publicar revisión" }).click();
  await expect(page.getByText("Configuración publicada.")).toBeVisible();

  expect(published?.group.limits.maxChildren).toBe(3);
  expect(published?.group.moderation.text.blockedTerms.es).toEqual(["tonto", "tonta"]);
  expect(published?.group.approvalQueue.holdAll).toBe(false);
  expect(published?.group.moderation.image.onUnavailable).toBe("block");
  expect(published?.group.moderation.text.onUnavailable).toBe("block");
  expect(published?.group.limits.relayEnabled).toBe(false);
});

test("AI operations console shows Ori's intervention with synthetic learners and explains a refused publish", async ({
  page,
}) => {
  const policy = {
    enabled: true,
    provider: "auto",
    model: "gpt-6-luna",
    timeoutMs: 7000,
    requestsPerMinute: 6,
    promptTemplate: "",
    fallback: "deterministic",
  };
  const capabilities = Object.fromEntries(
    ["mission", "advanced", "studio", "chat", "goals", "legacy"].map((key) => [
      key,
      { ...policy, provider: key === "legacy" ? "fake" : "auto" },
    ]),
  );
  const config = {
    schema: "agorix/ai-config/v3",
    capabilities,
    behavior: { intervention: { minFailedRuns: 1, minHints: 2, maxProposalBlocks: 8 } },
  };
  const history = [
    {
      revision: 1,
      author: "system",
      createdAt: new Date().toISOString(),
      action: "seed",
      sourceRevision: null,
    },
  ];
  await page.route("**/api/tutor/admin/**", async (route) => {
    const path = new URL(route.request().url()).pathname.split("/").at(-1);
    if (path === "session" && route.request().method() === "GET")
      return route.fulfill({ status: 401, json: { error: { code: "unauthorized" } } });
    if (path === "session") return route.fulfill({ json: { csrf: "csrf", author: "operator" } });
    if (path === "config")
      return route.fulfill({ json: { current: { ...history[0], config, revision: 1 }, history } });
    if (path === "preview")
      return route.fulfill({
        json: {
          valid: false,
          failures: ["too-few-goals"],
          changed: ["behavior"],
          expectedRevision: 1,
        },
      });
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto("/admin/ai");
  await page.getByLabel("Clave de administración").fill("a-strong-admin-password");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.getByRole("button", { name: /Intervención de Ori/ }).click();
  await expect(page.getByRole("heading", { name: "Intervención de Ori" })).toBeVisible();
  const table = page.getByRole("table", { name: "Aprendices simulados" });
  await expect(table.getByRole("row", { name: /Recién entra.*No, todavía no/ })).toBeVisible();
  await expect(table.getByRole("row", { name: /Primera corrida fallida.*Sí/ })).toBeVisible();
  await page.getByLabel(/Corridas que no llegan a la meta/).fill("2");
  await expect(
    table.getByRole("row", { name: /Primera corrida fallida.*No, todavía/ }),
  ).toBeVisible();
  // A gradual rollout shares the change with part of the devices, between 1 and 100 %.
  const rollout = page.getByLabel(/Dispositivos que reciben este cambio/);
  await expect(rollout).toHaveValue("100");
  await rollout.fill("0");
  await expect(rollout).toHaveValue("1");
  await rollout.fill("25");
  await expect(rollout).toHaveValue("25");
  // The floor is enforced in the control itself: a hint of 1 is clamped to 2.
  await page.getByLabel(/Pistas abiertas/).fill("1");
  await expect(page.getByLabel(/Pistas abiertas/)).toHaveValue("2");
  await page.getByRole("button", { name: "Validar cambios" }).click();
  await expect(page.getByRole("status").filter({ hasText: "No se puede publicar" })).toContainText(
    "muy pocas metas",
  );
  await expect(page.getByRole("button", { name: "Publicar revisión" })).toBeDisabled();
});

test("AI operations console explains each agent's role, locked rules and full instructions", async ({
  page,
}) => {
  const policy = {
    enabled: true,
    provider: "auto",
    model: "gpt-6-luna",
    timeoutMs: 7000,
    requestsPerMinute: 6,
    promptTemplate: "",
    fallback: "deterministic",
  };
  const capabilities = Object.fromEntries(
    ["mission", "advanced", "studio", "chat", "goals", "legacy"].map((key) => [
      key,
      { ...policy, provider: key === "legacy" ? "fake" : "auto" },
    ]),
  );
  const config = { schema: "agorix/ai-config/v3", capabilities };
  const history = [
    {
      revision: 1,
      author: "system",
      createdAt: new Date().toISOString(),
      action: "seed",
      sourceRevision: null,
    },
  ];
  await page.route("**/api/tutor/admin/**", async (route) => {
    const path = new URL(route.request().url()).pathname.split("/").at(-1);
    if (path === "session" && route.request().method() === "GET")
      return route.fulfill({ status: 401, json: { error: { code: "unauthorized" } } });
    if (path === "session") return route.fulfill({ json: { csrf: "csrf", author: "operator" } });
    if (path === "config")
      return route.fulfill({ json: { current: { ...history[0], config, revision: 1 }, history } });
    if (path === "agents")
      return route.fulfill({
        json: {
          lockedRules: ["closed-output-schema", "deterministic-fallback"],
          agents: [
            {
              capability: "chat",
              role: "classifier",
              contract: "agorix/ori-chat/v1",
              outputs: ["replyId: blocks | move | refusal"],
              input: "untrusted-child-choice",
              fixedInstructions: "Contract agorix/ori-chat/v1.",
              effectiveInstructions: "Contract agorix/ori-chat/v1.",
            },
          ],
        },
      });
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto("/admin/ai");
  await page.getByLabel("Clave de administración").fill("a-strong-admin-password");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.getByRole("button", { name: /Conversación/ }).click();
  const card = page.getByRole("region", { name: "Agente Clasificador" });
  await expect(card).toContainText("agorix/ori-chat/v1");
  await expect(card).toContainText("Solo puede devolver el esquema cerrado");
  await expect(card).toContainText("Si falla, responde la regla determinista");
  await expect(card).toContainText("nunca como instrucción");
  await card.getByText("Instrucciones completas que recibe el modelo").click();
  await expect(card.getByText("Contract agorix/ori-chat/v1.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Ori en misiones/ }).click();
  await expect(page.getByRole("region", { name: "Agente Clasificador" })).toHaveCount(0);
});

test("AI operations console edits the missions and shows a mission that cannot be won", async ({
  page,
}) => {
  const policy = {
    enabled: true,
    provider: "auto",
    model: "gpt-6-luna",
    timeoutMs: 7000,
    requestsPerMinute: 6,
    promptTemplate: "",
    fallback: "deterministic",
  };
  const capabilities = Object.fromEntries(
    ["mission", "advanced", "studio", "chat", "goals", "legacy"].map((key) => [
      key,
      { ...policy, provider: key === "legacy" ? "fake" : "auto" },
    ]),
  );
  const entry = (title: string) => ({
    start: { cx: 0, cy: 2 },
    goal: { cx: 4, cy: 2 },
    title: { es: title, en: title },
    story: { es: "Llegá a la meta.", en: "Reach the goal." },
  });
  const catalog = Object.fromEntries(
    ["space", "ocean", "robots", "city"].map((world) => [
      world,
      [entry("Uno"), entry("Dos"), entry("Tres")],
    ]),
  );
  const config = { schema: "agorix/ai-config/v4", capabilities, catalog };
  const history = [
    {
      revision: 1,
      author: "system",
      createdAt: new Date().toISOString(),
      action: "seed",
      sourceRevision: null,
    },
  ];
  let posted: { config?: { catalog?: Record<string, { title: { es: string } }[]> } } = {};
  await page.route("**/api/tutor/admin/**", async (route) => {
    const path = new URL(route.request().url()).pathname.split("/").at(-1);
    if (path === "session" && route.request().method() === "GET")
      return route.fulfill({ status: 401, json: { error: { code: "unauthorized" } } });
    if (path === "session") return route.fulfill({ json: { csrf: "csrf", author: "operator" } });
    if (path === "config")
      return route.fulfill({ json: { current: { ...history[0], config, revision: 1 }, history } });
    if (path === "preview") {
      posted = route.request().postDataJSON();
      return route.fulfill({
        json: { valid: true, failures: [], changed: ["catalog"], expectedRevision: 1 },
      });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto("/admin/ai");
  await page.getByLabel("Clave de administración").fill("a-strong-admin-password");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.getByRole("button", { name: /Misiones/ }).click();
  await expect(page.getByRole("heading", { name: "Misiones" })).toBeVisible();
  await page.getByRole("button", { name: "Océano" }).click();
  const first = page.getByRole("group", { name: /Océano · misión 1/ });
  await first.getByLabel("Título (español)").fill("Corriente corta");
  // The goal is kept to the right of the start, so a mission cannot be made unwinnable here.
  await first.getByLabel("Sale de la columna").fill("5");
  await expect(first.getByLabel("Sale de la columna")).toHaveValue("4");
  await expect(first.getByLabel("Meta en la columna")).toHaveValue("5");
  await first.getByLabel("Meta en la columna").fill("2");
  await expect(first.getByLabel("Meta en la columna")).toHaveValue("5");
  await page.getByRole("button", { name: "Validar cambios" }).click();
  await expect(page.getByText("Pasó las pruebas de seguridad")).toBeVisible();
  expect(posted.config?.catalog?.["ocean"]?.[0]?.title.es).toBe("Corriente corta");
  await page.getByRole("button", { name: "Volver a las misiones originales" }).click();
  await expect(first.getByLabel("Título (español)")).toHaveValue("Corriente recta");
});
