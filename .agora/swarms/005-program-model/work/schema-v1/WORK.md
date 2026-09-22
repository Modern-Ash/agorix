---
schema: "agora/work/v1"
id: "schema-v1"
swarm: "program-model"
title: "Issue #12: agorix/program/v1 canonical schema and TypeScript types"
state: "completed"
revision: 1
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria:
  {
    "outcome": "Documented example validates; every union has explicit discriminator; round-trip preserves semantic equality; unknown/future operation is rejected; schema/version exported",
  }
satisfied-criteria: ["outcome"]
criterion-statuses:
  { "outcome": ["elaborated", "designed", "built", "verified", "deployed", "accepted"] }
required-artifacts: []
child-work-refs: []
budget-limits: null
---

# Issue #12: agorix/program/v1 canonical schema and TypeScript types

## Description

Implement docs/architecture/PROGRAMMING_MODEL.md in packages/program-model: ProjectProgram/Script/Trigger/Statement/Expression types, validation, unit+snapshot+round-trip tests.

## Acceptance criteria

- [x] **outcome:** Documented example validates; every union has explicit discriminator; round-trip preserves semantic equality; unknown/future operation is rejected; schema/version exported; stages: elaborated, designed, built, verified, deployed, accepted

## Required artifacts

- none
