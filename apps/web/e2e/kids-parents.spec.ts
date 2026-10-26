import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { passAdultGate } from "./helpers.js";

test.use({ serviceWorkers: "block", hasTouch: true });

test("adult gate protects real progress, settings and AI status", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/kids");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({
        onboarded: true,
        avatar: "🐸",
        stars: 1,
        done: { "space:0": true },
      }),
    );
    const date = new Date();
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    localStorage.setItem("agorix.kids.usage.v1", JSON.stringify({ day, seconds: 125 }));
  });
  await page.reload();
  let healthRequests = 0;
  await page.route("**/api/tutor/health", (route) => {
    healthRequests++;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        configured: true,
        available: false,
        providerInUse: "deterministic",
        lastErrorClass: "provider-unavailable",
      }),
    });
  });
  await page.getByRole("button", { name: "Adultos" }).click();
  await expect(page.getByRole("heading", { name: /¿Cuánto es \d+ × \d+\?/ })).toBeVisible();
  await expect(page.getByText("Estado de la IA")).toHaveCount(0);
  expect(healthRequests).toBe(0);
  const gateViolations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((item) => item.impact === "serious" || item.impact === "critical");
  expect(gateViolations.map((item) => item.id)).toEqual([]);
  await page.keyboard.type("12");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Estado de la IA")).toHaveCount(0);
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "3", exact: true }).click();
  await page.getByRole("button", { name: "Comprobar" }).click();
  await expect(page.getByText("Probá otra vez.")).toBeVisible();
  await passAdultGate(page);
  await expect(page.getByRole("heading", { name: "Estado de la IA" })).toBeVisible();
  await expect(page.getByText("2 / 30 min")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Misiones completadas" }).locator(".."),
  ).toContainText("1");
  await expect(page.getByText("Todavía no hay evidencia suficiente")).toBeVisible();
  await expect(page.getByText("provider-unavailable")).toBeVisible();
  expect(healthRequests).toBe(1);
  await page.getByRole("switch", { name: /Ideas de Ori/ }).click();
  await expect(page.getByRole("switch", { name: /Ideas de Ori/ })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await page.getByRole("switch", { name: /Lectura en voz alta/ }).click();
  await page.getByRole("button", { name: "Meta diaria +" }).click();
  await expect(page.getByText("2 / 35 min")).toBeVisible();
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((item) => item.impact === "serious" || item.impact === "critical");
  expect(violations.map((item) => item.id)).toEqual([]);
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".kids-root button")]
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        return (
          rect.width > 0 &&
          (rect.left < -1 ||
            rect.right > document.documentElement.clientWidth + 1 ||
            rect.width < 44 ||
            rect.height < 44)
        );
      })
      .map((button) => button.textContent?.trim()),
  );
  expect(clipped).toEqual([]);
  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page.getByRole("heading", { name: /PIN de adulto/ })).toBeVisible();
  await page.getByRole("button", { name: "Mapa" }).click();
  await expect(page.getByRole("button", { name: "Escuchar" })).toHaveCount(0);
  await page.locator(".kids-node.current").click();
  await expect(page.locator(".kids-ori-card")).toHaveCount(0);
  await expect(page.getByText(/no conectad|not connected|provider-unavailable/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await page.getByRole("button", { name: "Adultos" }).click();
  await expect(page.getByRole("heading", { name: /PIN de adulto/ })).toBeVisible();
});
