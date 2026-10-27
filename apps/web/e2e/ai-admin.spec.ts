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
  await page.getByLabel("Instrucción adicional").fill("Preguntá qué predice el estudiante.");
  await expect(page.getByRole("button", { name: "Publicar revisión" })).toBeDisabled();
  await page.getByRole("button", { name: "Validar cambios" }).click();
  await page.getByRole("button", { name: "Publicar revisión" }).click();
  await expect(page.getByText("Configuración publicada.")).toBeVisible();
  page.on("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Restaurar" }).last().click();
  await expect(page.getByText("Revisión 1 restaurada.")).toBeVisible();
  await expect(page.getByLabel("Instrucción adicional")).toHaveValue("");
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
