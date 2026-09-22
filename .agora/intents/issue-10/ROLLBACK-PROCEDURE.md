---
schema: "agora/rollback-procedure/v1"
id: "issue-10-ux-requirements"
work: "issue-10-delivery/ux-requirements"
---

# Rollback procedure: UX requirements

Rollback is a plain git revert — the deliverable is a single Markdown file with no
migration, data or running service.

1. `git revert <merge-commit>` on `main` removes `docs/product/UX_REQUIREMENTS.md`.
2. No downstream code currently depends on this file (it predates the editor
   implementation), so revert has no cascading impact.
