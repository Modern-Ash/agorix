import { test as base, type Page } from "@playwright/test";

export * from "@playwright/test";

/**
 * `test` without the palette preference, for specs that exercise the default palette. It only
 * carries the WebKit loopback fix below.
 */
export const plainTest = base.extend({
  context: async ({ context, browserName }, use) => {
    if (browserName === "webkit") {
      // The page's CSP asks for `upgrade-insecure-requests`. Safari honours it even for a loopback
      // origin and then tries TLS against our plain-HTTP test server, so nothing loads. Chromium
      // exempts loopback. In production the site is HTTPS anyway; only the test server needs this.
      await context.route(
        (url) =>
          url.origin.startsWith("http://127.0.0.1") || url.origin.startsWith("http://localhost"),
        async (route) => {
          if (route.request().resourceType() !== "document") return route.continue();
          const response = await route.fetch();
          const strip = (text: string) => text.replace(/;?\s*upgrade-insecure-requests/g, "");
          const headers = { ...response.headers() };
          delete headers["content-length"];
          const csp = headers["content-security-policy"];
          if (csp !== undefined) headers["content-security-policy"] = strip(csp);
          await route.fulfill({ response, headers, body: strip(await response.text()) });
        },
      );
    }
    await use(context);
  },
});

/**
 * The block palette opens one colour at a time by default (#1110). Most journeys here add blocks
 * from every family, so they run with the "show all" preference the app also offers to children;
 * tests of the one-colour view remove it (see the palette view tests).
 */
export const test = plainTest.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(() => {
      try {
        window.localStorage.setItem("agorix.kids.palette.view.v1", "all");
        window.localStorage.setItem("agorix.kids.palette.contextual.v1", "1");
      } catch {
        // Storage can be unavailable in a test that blocks it on purpose.
      }
    });
    await use(context);
  },
});

/**
 * Starts the page from clean storage with the given entries, **before the app first runs**.
 *
 * The older way (open the page, clear and set storage, reload) races the page that is already
 * running: under load it can write its own state, rewrite the address or pick its language after
 * the test changed storage, so the reload comes up in English, on the map, or in another route
 * (#1230, #1317: the same specs failed on and off in CI). Seeding in an init script leaves no
 * running page to race. It runs once per tab, so a later reload keeps what the page saved.
 */
export async function seedStorage(page: Page, entries: Record<string, string>): Promise<void> {
  await page.addInitScript((seed) => {
    try {
      if (window.sessionStorage.getItem("agorix.e2e.seeded") !== null) return;
      window.sessionStorage.setItem("agorix.e2e.seeded", "1");
      window.localStorage.clear();
      // What the shared fixture above sets for every page, restored after the clear.
      window.localStorage.setItem("agorix.kids.palette.view.v1", "all");
      window.localStorage.setItem("agorix.kids.palette.contextual.v1", "1");
      for (const [key, value] of Object.entries(seed)) window.localStorage.setItem(key, value);
    } catch {
      // Storage can be unavailable in a test that blocks it on purpose.
    }
  }, entries);
}
