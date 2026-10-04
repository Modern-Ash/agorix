import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@agorix/platform-contract": new URL("../platform-contract/src/index.ts", import.meta.url)
        .pathname,
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
