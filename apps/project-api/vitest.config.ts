import { defineConfig } from "vitest/config";

const pkg = (name: string): string =>
  new URL(`../../packages/${name}/src/index.ts`, import.meta.url).pathname;

export default defineConfig({
  resolve: {
    alias: {
      "@agorix/auth-service": pkg("auth-service"),
      "@agorix/persistence": pkg("persistence"),
      "@agorix/platform-contract": pkg("platform-contract"),
      "@agorix/program-model": pkg("program-model"),
      "@agorix/project-repository": pkg("project-repository"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
