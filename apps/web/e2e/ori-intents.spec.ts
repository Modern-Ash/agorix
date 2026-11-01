import { test, expect } from "./fixtures.js";

test.describe("Ori educational intent chooser", () => {
  test.skip(process.env.VITE_ORI_EXPERIMENTAL_REVIEW !== "1", "Requires experimental build flag");
  test("supports five intents and learner review without program edits", async ({ page }) => {
    const requests: string[] = [];
    await page.route("**/api/tutor/ori/runtime-preview", async (route) => {
      const body = route.request().postDataJSON() as { intent: string };
      requests.push(body.intent);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ready",
          hint: `¿Qué podrías probar con ${body.intent}?`,
          nextStep: "Observá el resultado",
          requiresLearnerApproval: true,
          appliedChanges: false,
        }),
      });
    });
    await page.goto("/");
    const panel = page.getByTestId("ori-review-panel");
    await expect(panel).toBeVisible();
    const actions = [
      ["Necesito ayuda", "help"],
      ["¿Por qué no funciona?", "debug"],
      ["Quiero repetir pasos", "repeat"],
      ["Quiero mover un personaje", "move"],
      ["Quiero girar", "turn"],
    ] as const;
    for (const [label, intent] of actions) {
      await panel.getByRole("button", { name: label }).click();
      await expect(panel.getByText(`¿Qué podrías probar con ${intent}?`)).toBeVisible();
      await expect(panel.getByText("Solo para revisión. No se aplicaron cambios.")).toBeVisible();
    }
    expect(requests).toEqual(actions.map(([, intent]) => intent));
    await expect(panel.getByRole("button", { name: "Ya revisé esta pista" })).toBeDisabled();
    await panel.getByLabel("Voy a probar una idea").check();
    await panel.getByRole("button", { name: "Ya revisé esta pista" }).click();
    await expect(panel.getByRole("button", { name: "Pista revisada" })).toBeDisabled();
  });
  test("does not show a review action when Ori is unavailable", async ({ page }) => {
    await page.route("**/api/tutor/ori/runtime-preview", (route) =>
      route.fulfill({ status: 404, contentType: "application/json", body: "{}" }),
    );
    await page.goto("/");
    const panel = page.getByTestId("ori-review-panel");
    await panel.getByRole("button", { name: "Necesito ayuda" }).click();
    await expect(panel.getByText("Ori no está disponible en este momento.")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Ya revisé esta pista" })).toHaveCount(0);
  });
});
