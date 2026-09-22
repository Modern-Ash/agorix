import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["apps/*", "packages/*"],
    // Domain packages' `build` emits *.test.js into dist/ alongside the compiled
    // source; without this, Vitest collects and runs those compiled duplicates
    // too, silently doubling every test (found while working on issue #13).
    exclude: ["**/dist/**", "**/node_modules/**"],
  },
});
