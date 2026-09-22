---
schema: "agora/architecture/v1"
id: "issue-9-content-guide"
work: "delivery/first-work"
---

# Architecture: content guide placement

## Artifact location

`docs/product/CONTENT_GUIDE.md`, alongside `PEDAGOGY.md` and `MVP.md` — the same
product-docs tier, not the codebase.

## Consumption

- **Editor/tutor implementation (post-#8/#9)**: pulls literal copy strings from this
  guide when building UI components and tutor prompts; no separate copy source of
  truth is introduced.
- **CHILD_SAFETY_PRIVACY.md**: this guide must not diverge from its "no PII prompts"
  and "tutor suggestions can be wrong" requirements — treated as an upstream
  constraint, not duplicated logic.
- **LEARNER_JOURNEY.md (issue #8)**: layout/IA references copy categories by name
  (e.g. "mission panel," "code panel") that this guide fills with actual wording; no
  structural dependency in either direction.

## Change boundary

Future copy changes are edits to this single file; no code changes are required to
update wording, keeping product/eng concerns separated.
