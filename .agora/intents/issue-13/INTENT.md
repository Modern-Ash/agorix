---
schema: "agora/intent/v1"
id: "issue-13"
status: "accepted"
author: "project:product-owner"
affected-systems: ["Modern-Ash/agorix"]
constraints: ["each error has a stable code, a node/path reference, and a developer-safe message","duplicate ids across the whole program (not just within one script) must fail","POC size/nesting limits are explicit constants, not implicit engine limits","validation must not partially apply \u2014 a rejected program produces zero executable state"]
open-questions: []
source: "https://github.com/Modern-Ash/agorix/issues/13"
created-at: "2026-09-22T22:18:40.825216Z"
decided-by: "project:product-owner"
decided-at: "2026-09-22T22:18:44.984815Z"
decision-reason: "Scope matches issue #13's validate/error-contract requirements, extending #12's schema validator."
---

# Intent issue-13

## Problem

packages/program-model's validateProgram (issue #12) checks shape/discriminators but not uniqueness of ids, numeric bounds, or POC size/nesting limits, and its errors carry a path+message but no stable machine-readable code — so callers cannot distinguish error kinds programmatically, and a malformed or oversized program is not rejected before execution.

## Proposed outcome

Extend packages/program-model's validation with a stable error-code contract (each ProgramValidationError has a fixed code, a node/path reference, and a developer-safe message) and add the checks issue #13 requires beyond #12's shape validation: unique script/node ids, numeric bounds on move/turn/repeat counts, POC program size and nesting depth limits — such that valid fixtures pass, unknown schema/duplicate ids/unsupported operations/excessive size-or-depth each fail explicitly with a distinct code, and no partial execution can follow a validation failure (validation is all-or-nothing before any execution).
