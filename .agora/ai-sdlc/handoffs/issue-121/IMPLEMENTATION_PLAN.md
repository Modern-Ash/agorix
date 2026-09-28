# Implementation plan - issue #121

1. Add a platform-neutral compatibility module in `@agorix/persistence`.
2. Export compatibility helpers from the persistence package index.
3. Add deterministic VS Code extension tests that exercise Web persistence plus Studio opening/modification.
4. Document the cross-surface compatibility contract and update Studio architecture docs.
5. Run formatting, build and tests; then persist verification evidence in Agora.

## Scope boundaries

- No new browser UI.
- No VS Code command surface changes.
- No migration implementation beyond explicit unknown-version failure, because no older incompatible schema is introduced by this issue.
