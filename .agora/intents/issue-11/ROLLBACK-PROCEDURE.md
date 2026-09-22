---
schema: "agora/rollback-procedure/v1"
id: "issue-11-monorepo-toolchain"
work: "monorepo-toolchain/monorepo-skeleton"
---

# Rollback procedure: monorepo skeleton

1. `git revert <merge-commit>` on `main` removes the entire skeleton (apps,
   packages, extensions, root config).
2. Since no other issue has landed code on top of this skeleton yet, revert has no
   cascading impact at the time of this work item's completion. Once #12+ land,
   reverting this issue would require reverting or rebasing dependent work too —
   flagged here for future rollback planning, not a current blocker.
3. No database, deployment or external service is affected; this is a source-tree
   and `node_modules` (regenerable via `pnpm install`) change only.
