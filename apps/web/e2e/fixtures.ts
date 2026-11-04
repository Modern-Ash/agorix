import { test as base } from "@playwright/test";

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
