---
schema: "agora/unit-of-work/v1"
id: "issue-32-agora-bootstrap"
intent: "issue-32"
work: "product-poc/product-foundation"
source: "https://github.com/Modern-Ash/agorix/issues/32"
---

# Unit of work: Issue #32 Agora AI-SDLC bootstrap

## Scope

Confirm and complete Agorix's bootstrap as a real Agora AI-SDLC consumer, matching
`docs/delivery/AI_SDLC_SETUP.md`'s recommended configuration, and evidence each of
issue #32's six acceptance checkboxes individually.

## In scope

- Verify `.agora/project.md` records `active-flavor: ai-sdlc`, `active-profile:
starter`, `active-depth: standard` (already true from the original quickstart).
- Create a swarm named `product-poc` with an initial work item named
  `product-foundation`, matching the issue's recommended naming exactly.
- Declare at least two distinct actor runtime integrations (already done:
  `project:ai-runtime-2` → claude, `project:ai-primary` → codex).
- Run `agora validate` and confirm it passes (errors=0; benign warnings acceptable).
- Confirm no secrets exist in `.agora/project.md`, `ai-sdlc/project.yaml`, or actor
  files.
- Confirm the repository builds/is usable without any LLM credential (docs-only POC
  state at this point — no build step exists yet, so this is trivially true; will be
  re-verified once issue #11's toolchain lands).

## Out of scope

- Any code scaffolding (issue #11).
- Adding new Method Packs or changing the active flavor/profile/depth.
- Retiring the earlier `delivery` and `issue-10-delivery` swarms — they remain valid
  completed governance history for issues #9 and #10.

## Source material

- docs/delivery/AI_SDLC_SETUP.md — recommended installer configuration.
- docs/delivery/AGENTIC_DEVELOPMENT.md — multi-runtime/agent-portability model.
- GitHub issue #32 acceptance checklist.

## Dependencies

None blocking; this formalizes state that already exists rather than creating new
capability.
