import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.use({ hasTouch: true, serviceWorkers: "block" });

async function openMap(page: Page, band: "6-8" | "9-12" | "13+", enabled: boolean) {
  await page.goto("/kids");
  await page.evaluate(
    ({ band, enabled }) => {
      localStorage.clear();
      localStorage.setItem("agorix.locale", "es");
      localStorage.setItem("agorix.kids.flags.v1", JSON.stringify(enabled ? ["ageBands"] : []));
      localStorage.setItem(
        "agorix.kids.progress.v1",
        JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
      );
      localStorage.setItem(
        "agorix.kids.adults.v1",
        JSON.stringify({
          oriSuggestions: true,
          readAloud: true,
          dailyLimitMinutes: 30,
          ageBand: band,
        }),
      );
    },
    { band, enabled },
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Mapa" })).toBeAttached();
}

test("the default age band leaves the shipped screen unchanged", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await openMap(page, "6-8", false);
  await expect(page.locator(".kids-root")).toHaveAttribute("data-age-palette", "warm");
  await expect(page.locator(".kids-band-chip")).toHaveCount(0);
  await expect(page.locator(".kids-root")).toHaveScreenshot("band-default.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.04,
  });
});

for (const [band, palette, label] of [
  ["6-8", "warm", "6–8"],
  ["9-12", "balanced", "9–12"],
  ["13+", "compact", "13+"],
] as const) {
  test(`the ${band} band applies its palette and header chip`, async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await openMap(page, band, true);
    await expect(page.locator(".kids-root")).toHaveAttribute("data-age-palette", palette);
    await expect(page.locator(".kids-band-chip")).toHaveText(label);
    await expect(page.locator(".kids-root")).toHaveScreenshot(`band-${band}.png`, {
      animations: "disabled",
      maxDiffPixelRatio: 0.04,
    });
    const violations = (await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze())
      .violations;
    expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    await page.getByRole("button", { name: "Misión 1" }).click();
    await page.getByRole("button", { name: "+ mover", exact: true }).click();
    await page.getByRole("button", { name: "+ repetir", exact: true }).click();
    const panel = page.locator(".kids-editor-program-panel");
    const box = await panel.boundingBox();
    if (!box) throw new Error("Editor panel is not visible");
    // The natural panel is one pixel taller on CI. A fixed clip compares the
    // same 360 × 754 visual area on both Linux hosts.
    await expect(page).toHaveScreenshot(`band-${band}-editor.png`, {
      animations: "disabled",
      maxDiffPixelRatio: 0.04,
      clip: { x: Math.floor(box.x), y: Math.floor(box.y), width: 360, height: 754 },
    });
  });
}
