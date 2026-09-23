---
schema: "agora/rollback-procedure/v1"
id: "issue-16-text-projection"
work: "text-projection/text-projection"
---

# Rollback procedure: text projection

1. `git revert <merge-commit>` on `main` removes `packages/code-generator`'s
   projection implementation and tests, restoring the issue #11 placeholder
   export (`PACKAGE_NAME`).
2. Remove the `@agorix/program-model` dependency from
   `packages/code-generator/package.json` if the placeholder no longer needs
   it (or leave it — harmless workspace link).
3. No persisted program data depends on projection output: text is regenerated
   from the canonical `ProjectProgram` on every edit, so revert causes zero
   data loss.
4. UI consumers that already imported `projectProgram` fail typecheck until
   updated — that is intentional fail-fast, not a silent empty panel.
