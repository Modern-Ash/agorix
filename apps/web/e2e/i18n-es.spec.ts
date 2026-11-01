import { expect, test } from "./fixtures.js";

// Issue #360: the Spanish UI must not leak English labels (visible text, aria-label, title).
const ENGLISH_LEAKS = [
  /Show app menu|Hide app menu/,
  /Undo program edit|Redo program edit/,
  /Use AI (hint|challenge|explain) tool/,
  /\b(Collapse|Expand|Maximize|Restore) (Tools|Blocks|Preview|Code|AI|Trace)\b/,
  /\bClose (Tools|Blocks|Preview|Code|AI|Trace)\b/,
  /\bShift .* panel (left|right)\b/,
  /\b(Tools|Blocks|Preview|Code|AI|Trace) panel controls\b/,
  /Code projection|Compare with|Compare code projection/,
  /Event scripts|Stage execution controls|Variable watchers/,
  /^(Undo|Redo)$/,
];

test("the default Kids route starts in Spanish", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("heading", { name: "¡Hola!" })).toBeVisible();
});

test("the Spanish UI has no English labels in text, aria-label or title", async ({ page }) => {
  await page.goto("/advanced");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await page
    .getByRole("button", { name: "Mostrar menú" })
    .click({ timeout: 2000 })
    .catch(() => {});
  await page.getByRole("button", { name: /explicar con IA/ }).click();
  await page.locator(".stage-backstage-code").getByRole("button").first().click();

  const strings = await page.evaluate(() => {
    const found = new Set<string>();
    const clean = (value: string | null) => (value ?? "").replace(/\s+/g, " ").trim();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) found.add(clean(walker.currentNode.textContent));
    for (const element of document.querySelectorAll("[aria-label],[title]")) {
      found.add(clean(element.getAttribute("aria-label")));
      found.add(clean(element.getAttribute("title")));
    }
    return [...found].filter(Boolean);
  });

  const leaks = strings.filter((text) => ENGLISH_LEAKS.some((pattern) => pattern.test(text)));
  expect(leaks).toEqual([]);
});
