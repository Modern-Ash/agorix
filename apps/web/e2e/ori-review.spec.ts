import { test, expect } from "@playwright/test";

test.describe("Ori experimental review-only journey", () => {
  test.skip(process.env.VITE_ORI_EXPERIMENTAL_REVIEW !== "1", "Requires experimental build flag");
  test("shows a review-only hint without editing the program", async ({ page }) => {
    let requests = 0;
    await page.route("**/api/tutor/ori/runtime-preview", async (route) => {
      requests++;
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataJSON()).toEqual({ intent: "help" });
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({
          status: "ready", hint: "¿Qué podrías probar primero?",
          nextStep: "Observá qué sucede", requiresLearnerApproval: true,
          appliedChanges: false,
        }),
      });
    });
    await page.goto("/");
    const panel = page.getByTestId("ori-review-panel");
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: "Pedir una pista" }).click();
    await expect(panel.getByText("¿Qué podrías probar primero?")).toBeVisible();
    await expect(panel.getByText("Solo para revisión. No se aplicaron cambios.")).toBeVisible();
    expect(requests).toBe(1);
  });
  test("fails closed when the runtime endpoint is disabled", async ({ page }) => {
    await page.route("**/api/tutor/ori/runtime-preview", route =>
      route.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
    await page.goto("/");
    const panel = page.getByTestId("ori-review-panel");
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: "Pedir una pista" }).click();
    await expect(panel.getByText("Ori no está disponible en este momento.")).toBeVisible();
  });
});
