---
schema: "agora/intent/v1"
id: "issue-11"
status: "accepted"
author: "project:product-owner"
affected-systems: ["Modern-Ash/agorix"]
constraints: ["domain packages (program-model, runtime, stage, curriculum, code-generator, tutor-contract, persistence, platform-contract) must not import React, Blockly, Phaser, Capacitor, VS Code APIs or provider SDKs","platform-specific capabilities go behind adapters (platform-contract)","no duplicate program/runtime implementations by surface","mobile and VS Code directories may start as placeholders/config boundaries"]
open-questions: []
source: "https://github.com/Modern-Ash/agorix/issues/11"
created-at: "2026-09-22T21:10:36.393516Z"
decided-by: "project:product-owner"
decided-at: "2026-09-22T21:10:40.807858Z"
decision-reason: "Scope matches SYSTEM_DESIGN.md and issue #11; ready for swarm/work and requirements."
---

# Intent issue-11

## Problem

Agorix has no implementation skeleton yet; SYSTEM_DESIGN.md's multi-surface architecture (web/PWA, Capacitor mobile, VS Code) exists only as a design document, with no pnpm workspace, no shared TypeScript packages, and no engineering toolchain to enforce its domain-package boundaries.

## Proposed outcome

Create the pnpm monorepo skeleton per SYSTEM_DESIGN.md's proposed layout (apps/web, apps/tutor-api, apps/mobile placeholder, extensions/vscode placeholder, and 9 packages: program-model, block-editor, runtime, stage, curriculum, code-generator, tutor-contract, persistence, platform-contract), with TypeScript strict mode, shared tsconfig, ESLint, a formatter, Vitest, a Playwright skeleton, and root lint/test/build scripts, such that a clean install succeeds, root lint/test/build succeed, shared packages are importable from web, domain packages have zero UI/platform SDK imports, one CI command contract exists, and README developer bootstrap is documented.
