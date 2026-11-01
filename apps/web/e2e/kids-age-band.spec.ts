import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures.js";
import { passAdultGate, openAdultTab } from "./helpers.js";

// Issue #453: the age band is an adult setting, behind the ageBands flag.
test.use({ hasTouch: true, serviceWorkers: "block" });

async function openAdults(page: Page, flags: string[]) {
  await page.goto("/kids");
  await page.evaluate((list) => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem("agorix.kids.flags.v1", JSON.stringify(list));
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
  }, flags);
  await page.reload();
  await page.getByRole("button", { name: "Adultos" }).click();
  await passAdultGate(page);
  await openAdultTab(page, "Ajustes");
}

test("the selector is absent while the flag is off", async ({ page }) => {
  await openAdults(page, []);
  await expect(page.getByRole("group", { name: "Franja de edad" })).toHaveCount(0);
});

test("an adult picks a band, it persists and nothing leaves the device", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await openAdults(page, ["ageBands"]);
  const group = page.getByRole("group", { name: "Franja de edad" });
  await expect(group.getByRole("radio", { name: "6–8" })).toBeChecked();
  await group.getByRole("radio", { name: "9–12" }).check();
  const saved = await page.evaluate(() => localStorage.getItem("agorix.kids.adults.v1"));
  expect(JSON.parse(saved ?? "{}")).toMatchObject({ ageBand: "9-12" });
  await page.reload();
  await page.getByRole("button", { name: "Adultos" }).click();
  await passAdultGate(page);
  await openAdultTab(page, "Ajustes");
  await expect(
    page.getByRole("group", { name: "Franja de edad" }).getByRole("radio", { name: "9–12" }),
  ).toBeChecked();
  expect(requests.filter((url) => /ageBand|9-12/.test(decodeURIComponent(url)))).toEqual([]);
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  ).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(violations.map((v) => v.id)).toEqual([]);
});
