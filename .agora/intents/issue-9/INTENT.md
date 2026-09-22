---
schema: "agora/intent/v1"
id: "issue-9"
status: "accepted"
author: "project:product-owner"
affected-systems: ["Modern-Ash/agorix"]
constraints:
  [
    "concise and encouraging without being patronizing",
    "distinguish system feedback from AI tutor feedback",
    'avoid "wrong/bad" framing where behavior-specific feedback works',
    "no PII prompts",
    "AI tutor must not be anthropomorphized as a human friend",
    'generated code explained as "the code behind your blocks", not magic',
  ]
open-questions: []
source: "https://github.com/Modern-Ash/agorix/issues/9"
created-at: "2026-09-22T17:18:20.969454Z"
decided-by: "project:product-owner"
decided-at: "2026-09-22T20:40:46.316185Z"
decision-reason: "Elaborated scope matches GitHub issue #9; ready to move to unit-of-work and requirements for the CONTENT_GUIDE.md deliverable."
---

# Intent issue-9

## Problem

Define child-facing content, feedback and first-mission copy

## Proposed outcome

Deliver the outcome described by GitHub issue #9: Define child-facing content, feedback and first-mission copy

Concretely: publish `docs/product/CONTENT_GUIDE.md`, a consistent child-facing language system covering tone/reading-level principles, block/toolbox labels, Run/Stop/Reset, the generated-code panel explanation, mission intro copy, retry/error states, the success state, the tutor-unavailable state, hint-ladder wording (levels 0-5 per PEDAGOGY.md), the reflection prompt, and wording to avoid — grounded in PEDAGOGY.md, MVP.md and CHILD_SAFETY_PRIVACY.md.
