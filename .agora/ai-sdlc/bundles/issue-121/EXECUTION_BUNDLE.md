# Deterministic execution bundle

- Schema: agora-ai-sdlc/execution-bundle/v1
- Work: issue-121-delivery / issue-121
- Stage: construction
- Next action: resolve-governance-obligations
- Branch: feat/issue-121-cross-surface-compatibility
- Base: main
- HEAD: d9889568dceafadf370e6b965e714020522ce991

## Objective

Make “one product, multiple surfaces” a testable invariant.

## Acceptance criteria

- Web-created project opens in Studio
- Studio-created/modified canonical project opens in Web
- semantic hash/equivalence preserved through round trip
- unsupported newer schema fails explicitly
- presentation state does not contaminate program state
- locale switch remains independent
- no UI-specific identifiers leak into canonical model.

## Repository facts

- Languages: TypeScript, JavaScript
- Build systems: Node, pnpm
- Verification commands: pnpm test

## Changed and dirty paths

- changed: AGENTS.md
- changed: CONTRIBUTING.md
- changed: GOVERNANCE.md
- changed: LICENSE
- changed: README.es.md
- changed: README.md
- changed: apps/tutor-api/src/index.test.ts
- changed: apps/tutor-api/src/index.ts
- changed: apps/web/e2e/smoke.spec.ts
- changed: apps/web/package.json
- changed: apps/web/src/App.css
- changed: apps/web/src/App.test.tsx
- changed: apps/web/src/App.tsx
- changed: apps/web/src/editorModel.ts
- changed: apps/web/src/i18n.ts
- changed: apps/web/src/projectStorage.ts
- changed: docs/architecture/AI_TUTOR.md
- changed: docs/architecture/LEARNING_COMPANION.md
- changed: docs/architecture/SYSTEM_DESIGN.md
- changed: docs/architecture/adr/0001-phaser-stage-renderer.md
- changed: docs/architecture/adr/0002-open-source-license-and-governance.md
- changed: docs/architecture/adr/0003-product-i18n-l10n.md
- changed: docs/delivery/IMPLEMENTATION_ORDER.md
- changed: docs/delivery/POC_PLAN.md
- changed: docs/product/AGORIX_STUDIO.md
- changed: docs/product/COMPETITIVE_PRINCIPLES.md
- changed: docs/product/CONTENT_GUIDE.md
- changed: docs/product/DESIGN_SYSTEM.md
- changed: docs/product/INTERACTION_MODEL.md
- changed: docs/product/LEARNER_JOURNEY.md
- changed: docs/product/LEARNING_PROGRESSION.md
- changed: docs/product/MVP.md
- changed: docs/product/PEDAGOGY.md
- changed: docs/product/PRODUCT_INTENT.md
- changed: docs/product/TRANSLATION_GUIDE.md
- changed: docs/product/WORLDS.md
- changed: extensions/vscode/README.md
- changed: extensions/vscode/package.json
- changed: extensions/vscode/src/extension.ts
- changed: extensions/vscode/src/studioCore.test.ts
- changed: extensions/vscode/src/studioCore.ts
- changed: extensions/vscode/src/vscode-shim.d.ts
- changed: extensions/vscode/tsconfig.json
- changed: extensions/vscode/vitest.config.ts
- changed: packages/block-editor/package.json
- changed: packages/block-editor/src/adapter.ts
- changed: packages/block-editor/src/changes.ts
- changed: packages/block-editor/src/index.test.ts
- changed: packages/block-editor/src/index.ts
- changed: packages/block-editor/src/vocabulary.ts
- changed: packages/code-generator/src/fixtures.ts
- changed: packages/curriculum/package.json
- changed: packages/curriculum/src/index.test.ts
- changed: packages/curriculum/src/index.ts
- changed: packages/persistence/src/store.ts
- changed: packages/runtime/package.json
- changed: packages/runtime/src/execute.ts
- changed: packages/runtime/src/index.test.ts
- changed: packages/runtime/src/index.ts
- changed: packages/runtime/src/world.ts
- changed: packages/stage/package.json
- changed: packages/stage/src/index.test.ts
- changed: packages/stage/src/index.ts
- changed: packages/stage/src/model.ts
- changed: packages/stage/src/rendering.ts
- changed: packages/tutor-contract/package.json
- changed: packages/tutor-contract/src/index.test.ts
- changed: packages/tutor-contract/src/index.ts
- changed: pnpm-lock.yaml
- changed: pnpm-workspace.yaml
- changed: vitest.config.ts
- dirty: agora/activity.md

## Related paths

- docs/product/AGORIX_STUDIO.md
- apps/web/src/projectStorage.ts
- docs/architecture/adr/0003-product-i18n-l10n.md
- docs/product/COMPETITIVE_PRINCIPLES.md
- docs/product/CONTENT_GUIDE.md
- docs/product/DESIGN_SYSTEM.md
- docs/product/INTERACTION_MODEL.md
- docs/product/LEARNER_JOURNEY.md
- docs/product/LEARNING_PROGRESSION.md
- docs/product/MVP.md
- docs/product/PEDAGOGY.md
- docs/product/PRODUCT_INTENT.md
- docs/product/TRANSLATION_GUIDE.md
- docs/product/WORLDS.md
- extensions/vscode/src/studioCore.test.ts
- extensions/vscode/src/studioCore.ts
- AGENTS.md
- CONTRIBUTING.md
- GOVERNANCE.md
- LICENSE
- README.es.md
- README.md
- apps/web/e2e/smoke.spec.ts
- apps/web/src/App.test.tsx

## Mechanical risk flags

- dependency-or-build-change
- source-change-without-test-change
- working-tree-dirty

## Governance

- Human approval required: False
- Missing artifacts: domain-model, logical-design, implementation-plan, test-strategy, deployment-unit
- Missing evidence: test-suite
- Missing approvals: none
- Unsatisfied criteria: source-issue

This bundle is deterministic read-only context. It does not authorize Construction, approval, review or merge.
