---
schema: "agora/work/v1"
id: "repository-ci"
swarm: "ci"
title: "Issue #29: Add repository CI for lint, typecheck, unit, build and browser smoke"
state: "inception"
revision: 1
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria:
  {
    "ci-runs": "CI runs on PR",
    "cache-correctness": "cache cannot hide correctness failures",
    "browser-smoke": "browser smoke can run offline",
    "boundary-check": "package-boundary rule catches React/Blockly/Phaser/Capacitor/VS Code leaks into domain packages",
    "ci-evidence": "CI result can be recorded as Agora evidence",
    "root-match": "root commands and CI commands match",
  }
satisfied-criteria: ["ci-runs"]
criterion-statuses:
  {
    "ci-runs": ["elaborated", "designed", "built", "verified", "deployed", "accepted"],
    "cache-correctness": ["elaborated"],
    "browser-smoke": ["elaborated"],
    "boundary-check": ["elaborated"],
    "ci-evidence": ["elaborated"],
    "root-match": ["elaborated"],
  }
required-artifacts: ["domain-model", "architecture", "implementation-plan", "test-strategy"]
child-work-refs: []
budget-limits: null
---

# Issue #29: Add repository CI for lint, typecheck, unit, build and browser smoke

## Description

Establish engineering quality gates early and make their evidence consumable by Agora across the TypeScript multi-platform architecture. Required CI: lockfile/install validation, format/lint, TypeScript typecheck, unit/integration tests, production web/PWA build, Playwright smoke, dependency/security scan, package-boundary check. Constraints: deterministic fake tutor by default, no external LLM credential required, no secret-bearing fixtures, failure logs must be actionable.

## Acceptance criteria

- [x] **ci-runs:** CI runs on PR; stages: elaborated, designed, built, verified, deployed, accepted
- [ ] **cache-correctness:** cache cannot hide correctness failures; stages: elaborated
- [ ] **browser-smoke:** browser smoke can run offline; stages: elaborated
- [ ] **boundary-check:** package-boundary rule catches React/Blockly/Phaser/Capacitor/VS Code leaks into domain packages; stages: elaborated
- [ ] **ci-evidence:** CI result can be recorded as Agora evidence; stages: elaborated
- [ ] **root-match:** root commands and CI commands match; stages: elaborated

## Required artifacts

- domain-model
- architecture
- implementation-plan
- test-strategy
