---
schema: "agora/intent/v1"
id: "issue-28"
status: "accepted"
author: "project:product-owner"
affected-systems: ["Modern-Ash/agorix"]
constraints: ["platform-neutral storage adapter","versioned schema with explicit migrations","no PII","domain package must not import UI frameworks"]
open-questions: []
source: "https://github.com/Modern-Ash/agorix/issues/28"
created-at: "2026-09-22T22:30:00.000000Z"
decided-by: "project:product-owner"
decided-at: "2026-09-22T22:30:00.000000Z"
decision-reason: "Issue #28 requires versioned local persistence behind an abstraction before editor reload sync (#21)."
---

# Intent issue-28

## Problem

Projects must survive reload without coupling the canonical program to browser localStorage or any single platform storage API, and schema evolution needs explicit migrations with user-safe failure codes.

## Proposed outcome

A platform-neutral persistence boundary (packages/persistence) with a browser-local adapter, versioned stored documents, deterministic migrations, and stable PersistenceError codes such that save/load round-trips the canonical program, unknown versions fail explicitly, and corruption is user-safe — so issue #21 can persist visual/code sync on top of it.
