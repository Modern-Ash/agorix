import { expect, test, type Page } from "./fixtures.js";
import { clickCreateScene } from "./helpers.js";

// Issue #1237: after a pause at the very start, Ori's button invites ("¿Una idea?"). It carries no
// idea, opens nothing and sends nothing; the child decides. The page clock is simulated so the
// 25 s pause costs no real time.
test.use({ serviceWorkers: "block" });

async function emptyScene(page: Page, oriOn = true) {
  await page.clock.install();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/kids");
  await page.evaluate((on) => {
    localStorage.clear();
    localStorage.setItem("agorix.locale", "es");
    localStorage.setItem(
      "agorix.kids.progress.v1",
      JSON.stringify({ onboarded: true, avatar: "🐸", stars: 0, done: {} }),
    );
    if (!on) {
      const key = "agorix.kids.adults.v1";
      localStorage.setItem(
        key,
        JSON.stringify({
          oriSuggestions: false,
          readAloud: true,
          dailyLimitMinutes: 30,
          ageBand: "6-8",
          bandChosen: true,
        }),
      );
    }
  }, oriOn);
  await page.reload();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await clickCreateScene(page);
}

const rail = (page: Page) => page.getByRole("button", { name: "Abrir Ori" });

test("an idle empty project gets a quiet invitation, once (#1237)", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await emptyScene(page);
  await expect(rail(page)).toHaveAttribute("data-ori-state", "idle");
  await expect(rail(page)).toContainText("Ori");
  const loaded = requests.length; // what the app asks for on its own, before any pause

  await page.clock.fastForward(26_000);
  await expect(rail(page)).toHaveAttribute("data-ori-state", "nudge");
  await expect(rail(page)).toContainText("¿Una idea?");
  // An invitation, not an offer: nothing opened, no idea shown, nothing asked of the network.
  await expect(page.locator(".kids-studio-ori:not([data-collapsed='true'])")).toHaveCount(0);
  await expect(page.getByTestId("intent-card")).toHaveCount(0);
  expect(requests.slice(loaded)).toEqual([]);

  // It puts itself away, and does not come back this visit.
  await page.clock.fastForward(13_000);
  await expect(rail(page)).toHaveAttribute("data-ori-state", "idle");
  await page.clock.fastForward(60_000);
  await expect(rail(page)).toHaveAttribute("data-ori-state", "idle");
});

test("activity keeps it quiet, and a child with blocks is never nudged (#1237)", async ({
  page,
}) => {
  await emptyScene(page);
  await page.clock.fastForward(20_000);
  await page.keyboard.press("Shift"); // any key is activity: the pause starts over
  await page.clock.fastForward(20_000);
  await expect(rail(page)).toHaveAttribute("data-ori-state", "idle");

  await page.getByRole("button", { name: "+ Mover", exact: true }).click();
  await page.clock.fastForward(120_000);
  await expect(rail(page)).not.toHaveAttribute("data-ori-state", "nudge");
});

test("with Ori switched off by an adult there is nothing to nudge (#1237)", async ({ page }) => {
  await emptyScene(page, false);
  await page.clock.fastForward(60_000);
  await expect(rail(page)).toHaveCount(0);
});

test("reduced motion keeps the label but does not animate the avatar (#1237)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await emptyScene(page);
  await page.clock.fastForward(26_000);
  await expect(rail(page)).toContainText("¿Una idea?");
  await expect(rail(page).locator("> span:first-child")).toHaveCSS("animation-name", "none");
});

test("tapping the invitation opens Ori as usual and ends it (#1237)", async ({ page }) => {
  await emptyScene(page);
  await page.clock.fastForward(26_000);
  await rail(page).click();
  await expect(page.locator(".kids-studio-ori:not([data-collapsed='true'])")).toBeVisible();
  await expect(rail(page)).not.toHaveAttribute("data-ori-state", "nudge");
});
