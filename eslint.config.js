// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

const domainPackages = [
  "packages/program-model",
  "packages/runtime",
  "packages/stage",
  "packages/curriculum",
  "packages/code-generator",
  "packages/tutor-contract",
  "packages/persistence",
  "packages/platform-contract",
];

const forbiddenDomainImports = [
  "react",
  "react-dom",
  "blockly",
  "phaser",
  "@capacitor/core",
  "vscode",
  "openai",
  "@anthropic-ai/sdk",
];

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.turbo/**",
      ".venv/**",
      ".agora/**",
      "ai-sdlc/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // R4: domain packages must not import UI/platform SDK packages.
    files: domainPackages.map((pkg) => `${pkg}/src/**/*.{ts,tsx}`),
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: forbiddenDomainImports.map((name) => ({
            name,
            message:
              "Domain packages must not import UI frameworks, renderers, platform SDKs or provider SDKs (SYSTEM_DESIGN.md, AGENTS.md architecture invariants).",
          })),
        },
      ],
    },
  },
);
