---
schema: "agora/intent/v1"
id: "issue-29"
status: "accepted"
author: "project:product-owner"
affected-systems: ["Modern-Ash/agorix"]
constraints: ["no external LLM credential required for CI","no secret-bearing fixtures","failure logs actionable","root commands and CI commands match"]
open-questions: []
source: "https://github.com/Modern-Ash/agorix/issues/29"
created-at: "2026-09-22T23:00:00.000000Z"
decided-by: "project:product-owner"
decided-at: "2026-09-22T23:00:00.000000Z"
decision-reason: "Issue #29 gates every later PR; CI evidence is also an Agora artifact for AI-SDLC proof."
---

# Intent issue-29

## Problem

Without repository CI, lint/typecheck/test/build/boundary regressions land silently and Agora has no machine-checkable evidence for the engineering gates the AI-SDLC method expects.

## Proposed outcome

A GitHub Actions CI workflow covering lockfile install, lint, format, typecheck, unit tests, build, package-boundary check, Playwright browser smoke, dependency scan and an aggregate verify job — all driven by the same root scripts — such that PRs are gated, cache cannot hide correctness failures, and CI results are recordable as Agora evidence.
