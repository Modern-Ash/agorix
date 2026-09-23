---
schema: "agora/intent/v1"
id: "issue-16"
status: "accepted"
author: "project:product-owner"
affected-systems: ["Modern-Ash/agorix"]
constraints: ["deterministic formatting","no side effects","read-only projection","explicit unsupported-node error"]
open-questions: []
source: "https://github.com/Modern-Ash/agorix/issues/16"
created-at: "2026-09-23T00:10:00.000000Z"
decided-by: "project:product-owner"
decided-at: "2026-09-23T00:10:00.000000Z"
decision-reason: "Issue #16 delivers the continuous textual learning surface required beside blocks; projection is pure and domain-owned."
---

# Intent issue-16

## Problem

Without a continuous text projection of the canonical program, learners cannot read the educational TypeScript/JavaScript-like code that corresponds to the blocks they build, and the UI has no stable node-to-text mapping for highlighting.

## Proposed outcome

A deterministic projection from canonical `ProjectProgram` state to readable educational code with a canonical node-to-text-range mapping, implemented in `packages/code-generator` as pure functions with no side effects and explicit unsupported-node errors.
