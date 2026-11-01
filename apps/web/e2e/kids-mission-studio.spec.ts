import { expect, test } from "@playwright/test";

test("a map mission uses the complete creative editor and one evaluated project", async ({
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
  await page.getByRole("button", { name: "Misión 1" }).click();
  await expect(page.getByRole("heading", { name: "Camino recto" })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Objeto" })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Fondo" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Categorías de bloques" })).toBeVisible();
  expect(
    await page
      .getByRole("navigation", { name: "Categorías de bloques" })
      .getByRole("button")
      .count(),
  ).toBeGreaterThan(5);
  await expect(page.getByRole("button", { name: /Disfraces y fondos/ })).toBeVisible();
  await page.getByRole("button", { name: /Sonidos/ }).click();
  await expect(page.getByRole("group", { name: "Sonidos" })).toBeVisible();
  await expect(page.getByTestId("scene-goal")).toBeVisible();
  await page.getByRole("button", { name: "¿Qué bloque me ayuda?" }).click();
  await expect(page.getByTestId("ori-goal-block-diff")).toBeVisible();
  await expect(page.locator(".kids-program-block")).toHaveCount(0);
  await page.getByRole("button", { name: "Pista 1" }).click();
  await expect(page.getByText(/^Pista 1:/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/^Pista 1:/)).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Objeto" })).toBeVisible();
  await page.goto("/kids#/proyectos");
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Misión 1: Camino recto" })
    .getByRole("button", { name: "Jugar" })
    .click();
  await expect(page.getByRole("heading", { name: "Camino recto" })).toBeVisible();
  await expect(page.getByText(/^Pista 1:/)).toBeVisible();
});

test("only the creative scene run completes a map mission", async ({ page }) => {
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
  await page.getByRole("button", { name: "Misión 1" }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByTestId("scene-goal-result")).toContainText("Todavía no");
  const motion = page
    .getByRole("navigation", { name: "Categorías de bloques" })
    .getByRole("button", { name: "Movimiento" });
  const add = page.getByRole("button", { name: "+ Mover", exact: true });
  for (let index = 0; index < 4; index += 1) {
    await motion.click();
    await add.click();
  }
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByTestId("scene-goal-result")).toContainText("Lograste la meta");
  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await expect(page.getByRole("button", { name: "Misión 2" })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole("button", { name: "Misión 2" })).toBeEnabled();
});

test("mission objects and media stay in the evaluated scene on a phone", async ({ page }) => {
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
  await page.getByRole("button", { name: "Misión 1" }).click();
  await page.getByRole("button", { name: "+ Objeto" }).click();
  await page.getByRole("button", { name: "Agregar objeto" }).click();
  await expect(page.locator(".kids-studio-stage-actor")).toHaveCount(2);
  await page.getByRole("button", { name: "+ Fondo" }).click();
  await page.getByRole("button", { name: "Usar fondo" }).click();
  await page.reload();
  await expect(page.locator(".kids-studio-stage-actor")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "+ Fondo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Jugar", exact: true })).toBeVisible();
});

test("Ori's mission request omits account and device link data", async ({ page }) => {
  const bodies: string[] = [];
  await page.route("**/api/tutor/studio/ori", async (route) => {
    bodies.push(route.request().postData() ?? "");
    await route.fulfill({ status: 503, body: "" });
  });
  await page.goto("/kids");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem(
      "agorix.kids.link.v1",
      JSON.stringify({ token: "private-device-token", email: "test@example.invalid" }),
    );
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  });
  await page.reload();
  await page.getByRole("button", { name: "Misión 1" }).click();
  await page.getByRole("button", { name: "Mostrar ayuda de Ori" }).click();
  await page.getByRole("button", { name: "Pedirle una idea a Ori" }).click();
  await expect.poll(() => bodies.length).toBeGreaterThan(0);
  expect(bodies.join("\n")).not.toMatch(
    /private-device-token|test@example\.invalid|linkId|deviceToken/i,
  );
});
