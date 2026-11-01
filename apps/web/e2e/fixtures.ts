import { test as base } from "@playwright/test";

export * from "@playwright/test";

/**
 * The block palette opens one colour at a time by default (#1110). Most journeys here add blocks
 * from every family, so they run with the "show all" preference the app also offers to children;
 * tests of the one-colour view remove it (see the palette view tests).
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(() => {
      try {
        window.localStorage.setItem("agorix.kids.palette.view.v1", "all");
      } catch {
        // Storage can be unavailable in a test that blocks it on purpose.
      }
    });
    await use(context);
  },
});
