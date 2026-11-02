import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures.js";

import { BLOCKS_UNLOCKED } from "./helpers.js";

test.use({ hasTouch: true, serviceWorkers: "block" });

async function expectMapScreenshot(page: Page, name: string, maxDiffPixelRatio = 0.04) {
  const bounds = await page.locator(".kids-root").boundingBox();
  if (!bounds) throw new Error("Kids map is not visible");
  await expect(page).toHaveScreenshot(name, {
    animations: "disabled",
    maxDiffPixelRatio,
    clip: { x: Math.floor(bounds.x), y: Math.floor(bounds.y), width: 804, height: 1100 },
  });
}

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
  await page.evaluate(
    (state) => localStorage.setItem("agorix.kids.mastery.v1", state),
    BLOCKS_UNLOCKED,
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Mapa" })).toBeAttached();
}

test("the default age band leaves the shipped screen unchanged", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await openMap(page, "6-8", false);
  await expect(page.locator(".kids-root")).toHaveAttribute("data-age-palette", "warm");
  await expect(page.locator(".kids-band-chip")).toHaveCount(0);
  await expectMapScreenshot(page, "band-default.png");
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
    await expectMapScreenshot(page, `band-${band}.png`, band === "13+" ? 0.06 : 0.04);
    const violations = (await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze())
      .violations;
    expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });
}
