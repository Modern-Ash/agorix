---
schema: "agora/work/v1"
id: "error-codes"
swarm: "structured-validation"
title: "Issue #13: structured validation with stable error codes"
state: "completed"
revision: 1
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria:
  {
    "outcome": "Valid fixtures pass; unknown schema/duplicate ids/unsupported operations/excessive size-or-depth each fail with a distinct stable code; no partial execution after failure",
  }
satisfied-criteria: ["outcome"]
criterion-statuses:
  { "outcome": ["elaborated", "designed", "built", "verified", "deployed", "accepted"] }
required-artifacts: []
child-work-refs: []
budget-limits: null
---

# Issue #13: structured validation with stable error codes

## Description

Extend packages/program-model validation: stable error codes, unique id check, numeric bounds, POC size/nesting limits, table-driven positive/negative tests.

## Acceptance criteria

- [x] **outcome:** Valid fixtures pass; unknown schema/duplicate ids/unsupported operations/excessive size-or-depth each fail with a distinct stable code; no partial execution after failure; stages: elaborated, designed, built, verified, deployed, accepted

## Required artifacts

- none
