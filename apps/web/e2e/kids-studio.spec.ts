import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { evaluateOriStudioOutput, ORI_STUDIO_VERSION } from "@agorix/ori-agent";

test.use({ hasTouch: true, serviceWorkers: "block" });

test("free scene keeps independent character scripts and reopens the saved stage", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/kids");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  });
  await page.reload();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  await expect(page.getByRole("heading", { name: "Escena libre" })).toBeVisible();
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(violations.map((entry) => entry.id)).toEqual([]);
  await page.getByRole("button", { name: "+ Mover" }).click();
  await page.getByRole("button", { name: "+ Agregar personaje" }).click();
  await expect(page.getByRole("group", { name: "Personajes" }).getByRole("button")).toHaveCount(2);
  await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
  await page.getByRole("group", { name: "Personajes" }).getByRole("button").first().click();
  await expect(page.locator(".kids-program-block")).toContainText("Mover 1");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("2 bloques ejecutados")).toBeVisible();
  await expect(page.locator(".kids-ori-action")).toHaveAttribute("data-ori-state", "observing");
  await page.getByRole("button", { name: "Pedirle una idea a Ori" }).click();
  await expect(page.getByText("Ori tiene una idea para mirar y decidir.")).toBeVisible();
  await page.getByRole("button", { name: "Usar idea" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(2);
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.locator(".kids-program-block")).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(page.getByRole("group", { name: "Personajes" }).getByRole("button")).toHaveCount(2);
  await expect(page.locator(".kids-program-block")).toContainText("Mover 1");
});

test("looks and wait blocks change only the chosen character and survive reload", async ({
  page,
}) => {
  await page.goto("/kids");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  });
  await page.reload();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  await page.getByRole("button", { name: "+ Agregar personaje" }).click();
  await page.getByRole("textbox", { name: "Decir / Pensar" }).fill("Hola, Nova");
  await page.getByRole("button", { name: "+ Decir" }).click();
  await page.getByRole("button", { name: "+ Esperar" }).click();
  await page.getByRole("button", { name: "+ Esconder" }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByRole("group", { name: "Escenario" }).getByRole("button")).toHaveCount(1);
  await page.getByRole("button", { name: "Paso" }).click();
  await expect(page.locator(".kids-studio-bubble")).toHaveText("Hola, Nova");
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await page.getByRole("group", { name: "Personajes" }).getByRole("button").last().click();
  await expect(page.locator(".kids-program-block")).toHaveCount(3);
});

test("a tapped character runs its own event script after Play", async ({ page }) => {
  await page.goto("/kids");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  });
  await page.reload();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  await page.getByRole("button", { name: "+ Agregar personaje" }).click();
  await page.getByRole("combobox", { name: "Cuando" }).selectOption("onActorClicked");
  await page.getByRole("button", { name: "+ Girar a la derecha" }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText("0 bloques ejecutados")).toBeVisible();
  await page.getByRole("group", { name: "Escenario" }).getByRole("button").last().click();
  await expect(page.getByText("1 bloque ejecutado")).toBeVisible();
});

test("Ori's server idea is reviewed before it changes a free scene", async ({ page }) => {
  await page.goto("/kids");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  });
  await page.reload();
  const requests: unknown[] = [];
  await page.route("**/api/tutor/studio/ori", async (route) => {
    const context = route.request().postDataJSON();
    requests.push(context);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const decision = evaluateOriStudioOutput(context, {
      version: ORI_STUDIO_VERSION,
      kind: "program-suggestion",
      actorId: context.actorId,
      block: { type: "turn", degrees: -90 },
    });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ message: decision.message, proposal: decision.proposal }),
    });
  });
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  await page.getByRole("button", { name: "Pedirle una idea a Ori" }).click();
  await expect(page.locator(".kids-ori-action")).toHaveAttribute("data-ori-state", "thinking");
  await expect(
    page.getByText("Ori tiene una idea para tu escena.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".kids-ori-action")).toHaveAttribute("data-ori-state", "proposal");
  await expect(page.locator(".kids-program-block")).toHaveCount(0);
  await page.getByRole("button", { name: "Usar idea" }).click();
  await expect(page.locator(".kids-program-block")).toContainText("Girar a la izquierda");
  expect(requests).toHaveLength(1);
  expect(JSON.stringify(requests[0])).toContain("actor:studio-1-nova");
});

test("the adult Ori switch hides scene suggestions", async ({ page }) => {
  await page.goto("/kids");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
    localStorage.setItem(
      "agorix.kids.adults.v1",
      JSON.stringify({
        oriSuggestions: false,
        readAloud: true,
        dailyLimitMinutes: 30,
        ageBand: "6-8",
      }),
    );
  });
  await page.reload();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  await expect(page.getByRole("button", { name: "Pedirle una idea a Ori" })).toHaveCount(0);
});

test("free scene composes data, repeat, message and key events in a fresh session", async ({
  page,
}) => {
  await page.goto("/kids");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  });
  await page.reload();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await page.getByRole("button", { name: "Crear escena" }).click();
  await page.getByRole("textbox", { name: "Nombre" }).fill("Puntos");
  await page.getByRole("button", { name: "+ Crear variable" }).click();
  await page.getByRole("textbox", { name: "Nombre" }).fill("Tesoros");
  await page.getByRole("button", { name: "+ Crear lista" }).click();
  await page.getByRole("spinbutton", { name: "Número" }).fill("2");
  await page.getByRole("button", { name: "+ Fijar valor" }).click();
  await page.getByRole("button", { name: "+ Agregar número" }).click();
  await page.getByRole("spinbutton", { name: "Número" }).fill("1");
  await page.getByRole("button", { name: /\+ Si variable >/ }).click();
  await page.getByRole("button", { name: "+ Repetir", exact: false }).click();
  await page.getByRole("button", { name: "+ Enviar mensaje" }).click();
  await page.getByRole("button", { name: "+ Agregar personaje" }).click();
  await page.getByRole("combobox", { name: "Cuando" }).selectOption("onMessage");
  await page.getByRole("button", { name: "+ Mover" }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("group", { name: "Personajes" }).getByRole("button").first().click();
  await expect(page.getByText("Puntos: 2")).toBeVisible();
  await expect(page.getByText("Tesoros: 2")).toBeVisible();
  await expect(page.getByText("10 bloques ejecutados")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Escena libre" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await page.getByRole("group", { name: "Personajes" }).getByRole("button").last().click();
  await expect(page.getByRole("combobox", { name: "Cuando" })).toHaveValue("onMessage");
  await page.getByRole("combobox", { name: "Cuando" }).selectOption("onKeyPressed");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("button", { name: "Pulsar tecla: Space" }).click();
  await expect(page.getByText(/bloques ejecutados/)).toBeVisible();
});
