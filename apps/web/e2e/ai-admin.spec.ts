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
