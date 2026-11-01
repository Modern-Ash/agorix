import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures.js";
import { openAdultTab, passAdultGate } from "./helpers.js";

const TABS = ["Resumen", "Ajustes", "Personalizar", "Cuenta y privacidad"] as const;

/** Buttons pushed off the side or under 44 px, and whether the page scrolls sideways. */
async function layoutProblems(page: Page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const clipped = [...document.querySelectorAll<HTMLElement>(".kids-root button")]
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        return (
          rect.width > 0 &&
          (rect.left < -1 || rect.right > width + 1 || rect.width < 44 || rect.height < 44)
        );
      })
      .map((button) => button.getAttribute("aria-label") ?? button.textContent?.trim());
    return { clipped, sideways: document.documentElement.scrollWidth > width };
  });
}

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
  // Four tabs; the summary opens first and settings, status and privacy wait in their own tabs.
  for (const name of TABS) await expect(page.getByRole("tab", { name })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Resumen" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Resumen" })).toBeVisible();
  await expect(page.getByText("2 / 30 min")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Misiones completadas" }).locator(".."),
  ).toContainText("1");
  await expect(page.getByText("Todavía no hay evidencia suficiente")).toBeVisible();
  await expect(page.getByRole("switch")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Estado de la IA" })).toHaveCount(0);
  // The status was asked for once at the door, not again per tab.
  expect(healthRequests).toBe(1);

  await openAdultTab(page, "Ajustes");
  await page.getByRole("switch", { name: /Ideas de Ori/ }).click();
  await expect(page.getByRole("switch", { name: /Ideas de Ori/ })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await page.getByRole("switch", { name: /Lectura en voz alta/ }).click();
  await page.getByRole("button", { name: "Meta diaria +" }).click();
  await expect(page.getByText("35 min")).toBeVisible();

  await openAdultTab(page, "Cuenta y privacidad");
  await expect(page.getByRole("heading", { name: "Estado de la IA" })).toBeVisible();
  await expect(page.getByText("provider-unavailable")).toBeVisible();
  await expect(page.getByText(/No pedimos nombre, escuela ni ubicación/)).toBeVisible();
  expect(healthRequests).toBe(1);

  await openAdultTab(page, "Resumen");
  await expect(page.getByText("2 / 35 min")).toBeVisible();
  // The short privacy note on the summary leads to the full one.
  await page.getByRole("button", { name: "Ver privacidad" }).click();
  await expect(page.getByRole("tab", { name: "Cuenta y privacidad" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  // Arrows, Home and End move between tabs and keep focus on the chosen one.
  await page.getByRole("tab", { name: "Cuenta y privacidad" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Resumen" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Resumen" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Cuenta y privacidad" })).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("tab", { name: "Personalizar" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("Home");
  await expect(page.getByRole("tab", { name: "Resumen" })).toBeFocused();

  // No tab pushes the phone page sideways or hides a button, at 390 px and at 320 px.
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const name of TABS) {
      await openAdultTab(page, name);
      expect(await layoutProblems(page), `${name} at ${width} px`).toEqual({
        clipped: [],
        sideways: false,
      });
      const violations = (
        await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
      ).violations.filter((item) => item.impact === "serious" || item.impact === "critical");
      expect(
        violations.map((item) => item.id),
        `${name} at ${width} px`,
      ).toEqual([]);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
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

test("a shortcut lands on the tab it is about, and Exit starts again at the summary", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/kids");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem("agorix.kids.flags.v1", JSON.stringify(["ageBands"]));
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  });
  await page.reload();
  await page.getByRole("button", { name: "Elegir la franja de edad" }).click();
  await passAdultGate(page);
  await expect(page.getByRole("tab", { name: "Ajustes" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("group", { name: "Franja de edad" })).toBeVisible();
  await page.getByRole("button", { name: "Salir" }).click();
  await passAdultGate(page);
  await expect(page.getByRole("tab", { name: "Resumen" })).toHaveAttribute("aria-selected", "true");
});
