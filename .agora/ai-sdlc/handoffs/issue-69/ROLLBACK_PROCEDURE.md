---
schema: "agora-ai-sdlc/artifact/v1"
kind: "rollback-procedure"
version: 1
id: "RB-069"
work: "issue-69"
revision: 1
traces-to: ["DU-069"]
---

# Rollback Procedure

## Scope

Rollback is documentation-only. No runtime or data-plane rollback is required.

## Procedure

1. Revert the PR or commit that changes:
   - docs/product/PRODUCT_INTENT.md
   - docs/product/PEDAGOGY.md
   - docs/product/LEARNER_JOURNEY.md
   - docs/product/CONTENT_GUIDE.md
2. Re-run documentation checks:
   - git diff --check
   - targeted acceptance text search if partial rollback is used
3. Confirm issue #70-#72 do not depend on reverted wording before proceeding.

## Risk

Rollback would restore the older tutor-centric source of truth, so it should also pause Wave 0 work that depends on #69.
