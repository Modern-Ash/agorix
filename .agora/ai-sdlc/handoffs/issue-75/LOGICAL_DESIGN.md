# Logical design - issue #75

## Shared package

Add `packages/proposals` as `@agorix/proposals`.

Responsibilities:

- v1 ProgramProposal schema and validation;
- bounded operation application;
- stale base hash checks;
- candidate program validation;
- deterministic diff/preview;
- accept/reject/modify decisions;
- provider-neutral audit event;
- Web/Tablet proposal card view model;
- Studio proposal diff view model.

## Integration

- `extensions/vscode/src/studioCore.ts` imports shared proposal helpers and keeps Studio as a projection/review surface.
- `apps/web` can import Web/Tablet view-model helpers without adding UI-heavy behavior in this issue.
- Tests live in `packages/proposals` and focused Studio tests verify the same fixture/view semantics.
