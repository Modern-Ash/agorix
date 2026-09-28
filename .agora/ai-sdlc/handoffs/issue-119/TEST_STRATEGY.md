# Test Strategy

## Automated checks

- `pnpm build` verifies TypeScript workspace build remains valid.
- `pnpm test` verifies existing runtime, curriculum, stage, persistence, web and contract tests
  still pass after documentation changes.

## Review checks

- Confirm `docs/product/WORLDS.md` states no canonical program schema changes are required for
  adding Worlds.
- Confirm mission identity remains locale-independent.
- Confirm assets can vary by locale/theme without logic forks.
- Confirm Web and Studio Preview render from shared mission/runtime/world inputs.
- Confirm reduced-motion behavior and asset/license requirements are documented.

## Non-goals

No new executable renderer tests are required for this documentation-scoped issue because #119
defines architecture and source of truth, not the implementation of a World renderer.
