---
schema: "agora/architecture/v1"
id: "issue-10-ux-requirements"
work: "issue-10-delivery/ux-requirements"
---

# Architecture: UX requirements placement

## Artifact location

`docs/product/UX_REQUIREMENTS.md`, alongside `PEDAGOGY.md`, `MVP.md` and
`CONTENT_GUIDE.md` — the product-docs tier, not the codebase.

## Consumption

- **Editor implementation (post-#8/#9/#10)**: implements against these checkable
  assertions directly; each becomes an implementation acceptance check.
- **Playwright/a11y test suite (issue #31)**: derives automated checks 1:1 from the
  checkboxes here — this file is the requirements source for that later test work,
  not a duplicate of it.
- **LEARNER_JOURNEY.md**: this file's layout-dependent requirements (§9, §10) are
  downstream of LEARNER_JOURNEY.md's D2 decision; if D2 changes, §9/§10 must be
  revisited.

## Change boundary

Future accessibility requirement changes are edits to this single file; the
Playwright/a11y suite is updated to match, not the other way around.
