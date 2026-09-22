---
schema: "agora/intent/v1"
id: "issue-32"
status: "accepted"
author: "project:product-owner"
affected-systems: ["Modern-Ash/agorix"]
constraints:
  [
    ".agora/ must be present and valid",
    "at least two distinct runtime declarations supported if available",
    "install config contains no secrets",
    "repository remains buildable without any LLM credential",
  ]
open-questions: []
source: "https://github.com/Modern-Ash/agorix/issues/32"
created-at: "2026-09-22T20:55:44.993490Z"
decided-by: "project:product-owner"
decided-at: "2026-09-22T20:55:47.770772Z"
decision-reason: "Scope matches GitHub issue #32; ready for swarm/work creation and runtime declaration."
---

# Intent issue-32

## Problem

Agorix is documented as an Agora AI-SDLC consumer but bootstrap has not been formalized against the installer's recommended configuration and multi-runtime declaration.

## Proposed outcome

Confirm and, where missing, complete Agorix's Agora AI-SDLC bootstrap: active flavor/profile/depth recorded (ai-sdlc/starter/standard, already true), a swarm named product-poc with an initial work item product-foundation created per docs/delivery/AI_SDLC_SETUP.md, at least two distinct actor runtime declarations present, agora validate passing, no secrets in install config, and the repository remaining buildable without any LLM credential.
