---
schema: "agora/intent/v1"
id: "issue-12"
status: "accepted"
author: "project:product-owner"
affected-systems: ["Modern-Ash/agorix"]
constraints:
  [
    "every union (Trigger, Statement, Expression) has an explicit discriminator field",
    "no Blockly-specific fields anywhere in the schema",
    "no executable functions in the persisted JSON form",
    "unknown/future operation must fail validation, not silently pass through",
    "schema/version constant is exported for persistence and migration code to consume",
  ]
open-questions: []
source: "https://github.com/Modern-Ash/agorix/issues/12"
created-at: "2026-09-22T21:25:11.813411Z"
decided-by: "project:product-owner"
decided-at: "2026-09-22T21:25:15.999730Z"
decision-reason: "Scope matches PROGRAMMING_MODEL.md and issue #12; ready for swarm/work and requirements."
---

# Intent issue-12

## Problem

Agorix has no canonical program representation yet; visual blocks would otherwise become the implicit source of truth, contradicting PROGRAMMING_MODEL.md's requirement that the editor is a representation, not the authority.

## Proposed outcome

Implement the agorix/program/v1 schema and TypeScript types in packages/program-model per docs/architecture/PROGRAMMING_MODEL.md: ProjectProgram, Script (onStart trigger), Statements (move, turn, repeat, if), Expressions (touchingGoal, boolean/numeric literals), each union with an explicit discriminator, stable node/script ids, deterministic JSON serialization, no Blockly-specific fields, no executable functions in persisted form, with the schema/version exported for later persistence/migration use, and unit+snapshot+round-trip tests proving semantic-equality round-tripping and rejection of unknown/future operations.
