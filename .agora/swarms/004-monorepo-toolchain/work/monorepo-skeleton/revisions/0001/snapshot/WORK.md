---
schema: "agora/work/v1"
id: "monorepo-skeleton"
swarm: "monorepo-toolchain"
title: "Issue #11: TypeScript pnpm monorepo and engineering toolchain"
state: "completed"
revision: 1
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria:
  {
    "outcome": "Clean install, root lint/test/build succeed; shared packages importable from web; domain packages have zero UI/platform SDK imports; one CI command contract exists; README developer bootstrap documented",
  }
satisfied-criteria: ["outcome"]
criterion-statuses:
  { "outcome": ["elaborated", "designed", "built", "verified", "deployed", "accepted"] }
required-artifacts: []
child-work-refs: []
budget-limits: null
---

# Issue #11: TypeScript pnpm monorepo and engineering toolchain

## Description

Create the SYSTEM_DESIGN.md pnpm monorepo skeleton (apps + 9 domain packages) with strict TypeScript, ESLint, formatter, Vitest, Playwright skeleton and root scripts.

## Acceptance criteria

- [x] **outcome:** Clean install, root lint/test/build succeed; shared packages importable from web; domain packages have zero UI/platform SDK imports; one CI command contract exists; README developer bootstrap documented; stages: elaborated, designed, built, verified, deployed, accepted

## Required artifacts

- none
