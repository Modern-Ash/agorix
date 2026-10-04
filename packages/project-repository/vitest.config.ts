import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@agorix/persistence": new URL("../persistence/src/index.ts", import.meta.url).pathname,
      "@agorix/program-model": new URL("../program-model/src/index.ts", import.meta.url).pathname,
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
