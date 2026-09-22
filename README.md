# Agorix

Agorix is a creative coding platform for children, built as a real-world proof of concept for Agora AI-SDLC.

The product starts with visual programming and progressively bridges learners toward textual code through projects, games, guided challenges, and an AI tutor designed to teach rather than solve.

This repository is governed using Agora AI-SDLC. Product intent, architecture, implementation plans, evidence, reviews, and delivery work are tracked as explicit artifacts and GitHub issues.


## Two synchronized learning surfaces

Agorix keeps the visual program and its generated textual code visible together. Learners see the code associated with their blocks continuously rather than switching to a separate advanced mode.

## Agentic AI development proof

Agorix is also a practical multi-agent Agora AI-SDLC experiment. Claude, Codex, Copilot, OpenCode and local/Ollama-backed agents can execute bounded roles while Agora provides the common contracts, provenance, gates, evidence and independent review.


## Start building

The recommended issue/dependency sequence is documented in [Implementation order](docs/delivery/IMPLEMENTATION_ORDER.md). Agents should start from GitHub issues and the referenced product/architecture specs rather than private chat context.


## Multi-platform target

Agorix is TypeScript-first. The reference application is React/Vite + Phaser, delivered first as Web/PWA, then packaged for Android/iOS with Capacitor. A VS Code extension reuses the same canonical program/runtime/code-generation packages rather than creating a separate implementation.

## Developer bootstrap

Prerequisites: Node 22 (see `.nvmrc`) and pnpm 9 via Corepack.

```bash
git clone https://github.com/Modern-Ash/agorix.git
cd agorix
corepack enable        # one-time, enables the pnpm shim declared in package.json
pnpm install            # clean install
pnpm dev --filter @agorix/web   # run the web app locally (http://localhost:5173)
pnpm lint                # ESLint across the workspace
pnpm test                 # Vitest across the workspace
pnpm build                 # build all packages/apps
pnpm run verify              # install --frozen-lockfile && lint && test && build, single command/exit code
                               # (note: `pnpm ci` is a reserved pnpm command, not this script — use `pnpm run verify`)
```

### Repository layout

```
apps/web            React + Vite reference UI
apps/tutor-api      Only surface allowed to call an external LLM provider (placeholder)
apps/mobile         Capacitor packaging placeholder
extensions/vscode   VS Code extension placeholder
packages/*          9 domain packages (program-model, block-editor, runtime, stage,
                     code-generator, curriculum, tutor-contract, persistence,
                     platform-contract) — see each package's README.md
```

Domain packages under `packages/` must not import React, Blockly, Phaser, Capacitor,
VS Code APIs or provider SDKs — enforced by the root ESLint config's
`no-restricted-imports` rule, not just convention.
