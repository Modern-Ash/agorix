---
schema: "agora/requirements/v1"
id: "issue-32-agora-bootstrap"
intent: "issue-32"
work: "product-poc/product-foundation"
source: "https://github.com/Modern-Ash/agorix/issues/32"
---

# Requirements: Issue #32 Agora AI-SDLC bootstrap

Each requirement maps 1:1 to one of issue #32's six acceptance checkboxes.

## R1 — .agora/ present and valid

`.agora/` exists at the repository root and `agora validate` reports zero errors
(warnings are acceptable if benign, e.g. stale-clarification notices on unrelated
prior work items).

## R2 — Active flavor/profile/depth recorded

`.agora/project.md` records `active-flavor: ai-sdlc`, `active-profile: starter`,
`active-depth: standard`.

## R3 — First swarm/work created

A swarm named `product-poc` exists with `method: ai-sdlc`, and an initial work item
named `product-foundation` exists under it, matching `docs/delivery/AI_SDLC_SETUP.md`.

## R4 — Multi-runtime declaration

At least two project actors declare distinct `integration` values (e.g. `claude` and
`codex`), each with `provider`/`model` set and no credential material committed.

## R5 — No secrets in install config

`.agora/project.md`, `ai-sdlc/project.yaml`, and all `.agora/actors/*.md` files
contain no API keys, tokens, or other credential material — `provider`/`model` fields
are configuration values only.

## R6 — Buildable without LLM credential

The repository's current state (documentation-only POC artifacts; no build tooling
yet from issue #11) requires no LLM credential to clone, read, or validate via
`agora validate`. This requirement will be re-verified once a build step exists.

## Traceability

R1-R6 trace 1:1 to issue #32's acceptance checklist; evidence is `agora validate`
output plus this requirements document, reviewed and accepted by the product-owner.
