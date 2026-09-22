---
schema: "agora/rollback-procedure/v1"
id: "issue-9-content-guide"
work: "delivery/first-work"
---

# Rollback procedure: content guide

Rollback is a plain git revert — the deliverable is a single Markdown file with no
migration, data or running service.

1. `git revert <merge-commit>` on `main` removes `docs/product/CONTENT_GUIDE.md`.
2. No downstream code currently depends on this file (it predates the editor
   implementation), so revert has no cascading impact.
