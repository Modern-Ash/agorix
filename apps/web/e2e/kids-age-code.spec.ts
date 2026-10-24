import { expect, test, type Page } from "@playwright/test";

test.use({ hasTouch: true, serviceWorkers: "block" });

async function start(page: Page) {
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
}

async function pickBand(page: Page, band: "6–8" | "9–12" | "13+") {
  await page.getByRole("button", { name: "Adultos" }).click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "2", exact: true }).click();
  await page.getByRole("button", { name: "Comprobar" }).click();
  await page
    .getByRole("group", { name: "Franja de edad" })
    .getByRole("radio", { name: band })
    .check();
  await page.reload();
  await page.getByRole("button", { name: "Misión 1" }).click();
  await page.getByRole("button", { name: "Código", exact: true }).click();
}

test("adult age band controls code tabs after reload and Ori shape", async ({ page }) => {
  await start(page);
  for (const [band, shape, tabs] of [
    ["6–8", "round", ["Agorix Code"]],
    ["9–12", "soft", ["Agorix Code", "Python", "TypeScript / Node"]],
    ["13+", "angular", ["Agorix Code", "Python", "TypeScript / Node", "Java"]],
  ] as const) {
    await pickBand(page, band);
    const group = page.getByRole("group", { name: "Código" });
    await expect(group.getByRole("button")).toHaveCount(band === "6–8" ? 2 : tabs.length);
    for (const tab of tabs) await expect(group.getByRole("button", { name: tab })).toBeVisible();
    await expect(page.locator(".kids-ori-card")).toHaveAttribute("data-ori-shape", shape);
    if (band === "6–8") {
      await group.getByRole("button", { name: "Más lenguajes" }).click();
      await expect(group.getByRole("button", { name: "Java" })).toBeVisible();
      await group.getByRole("button", { name: "Menos lenguajes" }).click();
      await expect(group.getByRole("button", { name: "Java" })).toHaveCount(0);
    }
    await page.getByRole("button", { name: "Volver al mapa" }).click();
  }
});

test("each projection reads the same canonical program without changing it", async ({ page }) => {
  await start(page);
  await pickBand(page, "13+");
  await page.getByRole("button", { name: "Bloques", exact: true }).click();
  await page.getByRole("button", { name: "+ mover", exact: true }).click();
  const program = await page.evaluate(() =>
    localStorage.getItem("agorix:kids.space.kids.m1.straight"),
  );
  await page.getByRole("button", { name: "Código", exact: true }).click();
  const group = page.getByRole("group", { name: "Código" });
  for (const [tab, expected] of [
    ["Agorix Code", "move"],
    ["Python", "move("],
    ["TypeScript / Node", "move("],
    ["Java", "move("],
  ]) {
    await group.getByRole("button", { name: tab, exact: true }).click();
    await expect(page.locator(".kids-code-view")).toContainText(expected);
    expect(
      await page.evaluate(() => localStorage.getItem("agorix:kids.space.kids.m1.straight")),
    ).toBe(program);
  }
});

test("blocks stay free of generated code in every age band while Code stays synchronized", async ({
  page,
}) => {
  await start(page);
  for (const band of ["6–8", "9–12", "13+"] as const) {
    await pickBand(page, band);
    await page.getByRole("button", { name: "Bloques", exact: true }).click();
    await expect(page.locator(".kids-code-strip, .kids-code-label")).toHaveCount(0);
    await page.getByRole("button", { name: "+ mover", exact: true }).click();
    await expect(page.locator(".kids-code-strip, .kids-code-label")).toHaveCount(0);
    await page.getByRole("button", { name: "Código", exact: true }).click();
    await expect(page.locator(".kids-code-view")).toContainText("move");
    await page.getByRole("button", { name: "Volver al mapa" }).click();
  }
});
