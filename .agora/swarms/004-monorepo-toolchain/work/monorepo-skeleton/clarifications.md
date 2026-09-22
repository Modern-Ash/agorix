---
schema: "agora/clarifications/v1"
swarm: "monorepo-toolchain"
work: "monorepo-skeleton"
created-at: "2026-09-22T21:11:06.985886Z"
last-run-input-sha256: "41a8c505830fd248749b251de42bc9810ab19c307936ebca5fd07f499e235308"
last-run-question-count: 5
last-run-unanswered-count: 0
last-run-by: "project:ai-runtime-2"
last-run-at: "2026-09-22T21:11:06.985886Z"
---

# Clarifications for monorepo-skeleton

| Question | Answer | Actor | Timestamp | Input SHA-256 |
| --- | --- | --- | --- | --- |
| What are the names/responsibilities of the 9 domain packages to scaffold? | Exactly SYSTEM_DESIGN.md's list: program-model (canonical serializable AST), block-editor (Blockly↔program-model mapping, no Blockly leakage into domain), runtime (deterministic execution/observations), stage (framework-neutral stage state/commands), code-generator (program-model→readable code projection), curriculum (missions/completion predicates/hint ladders), tutor-contract (provider-neutral request/response + guardrails), persistence (versioned project storage abstraction), platform-contract (filesystem/persistence-backend/sharing capability boundary). | project:product-owner | 2026-09-22T21:11:06.985886Z | 41a8c505830fd248749b251de42bc9810ab19c307936ebca5fd07f499e235308 |
| Which apps belong in apps/ (e.g., web only, or also mobile/admin), and what shells do they need? | apps/web (React+Vite, the reference UI, imports the domain packages), apps/tutor-api (the only component allowed to call an external LLM provider, per SYSTEM_DESIGN.md "tutor-api" boundary — starts as a minimal Node/TS server shell with no real provider call yet), apps/mobile (Capacitor config placeholder only, per issue #11 "may start as placeholders"). extensions/vscode is a placeholder directory, not under apps/. | project:product-owner | 2026-09-22T21:11:06.985886Z | 41a8c505830fd248749b251de42bc9810ab19c307936ebca5fd07f499e235308 |
| Which formatter should be used (Prettier vs Biome) and should it also own linting, or stay separate from ESLint? | Prettier for formatting, ESLint for linting — kept separate (eslint-config-prettier disables ESLint's stylistic rules so the two never conflict). This is the more conservative/widely-documented pairing for a POC being read by multiple coding agents. | project:product-owner | 2026-09-22T21:11:06.985886Z | 41a8c505830fd248749b251de42bc9810ab19c307936ebca5fd07f499e235308 |
| What pnpm and Node versions should be pinned (engines field, .nvmrc, packageManager field)? | Node 22 LTS (.nvmrc = 22), pnpm 9 via the root package.json `packageManager` field (Corepack-managed, no separate global pnpm install required), and an `engines` field enforcing both. | project:product-owner | 2026-09-22T21:11:06.985886Z | 41a8c505830fd248749b251de42bc9810ab19c307936ebca5fd07f499e235308 |
| What is the required single CI command contract's name/interface (e.g., a root `pnpm ci` script), and which CI platform must consume it? | A root `pnpm ci` script (install --frozen-lockfile && lint && test && build) as the single command contract; issue #29 (repository CI) is the one that wires an actual CI platform (GitHub Actions) to call it — this issue only needs the command to exist and pass locally. | project:product-owner | 2026-09-22T21:11:06.985886Z | 41a8c505830fd248749b251de42bc9810ab19c307936ebca5fd07f499e235308 |
