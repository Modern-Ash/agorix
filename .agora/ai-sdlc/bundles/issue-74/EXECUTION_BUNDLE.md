# Deterministic execution bundle

- Schema: agora-ai-sdlc/execution-bundle/v1
- Work: issue-74-delivery / issue-74
- Stage: construction
- Next action: resolve-governance-obligations
- Branch: feat/issue-74-transparent-programming-ux
- Base: main
- HEAD: b282fc6dc8d0fa3ab7cd4dfe772d5f5956df9f81

## Objective

Translate “Nothing happens under the rug” into testable UX and architecture rules before implementation.

## Acceptance criteria

- every program mutation path is documented
- there is no allowed silent AI mutation path
- Step behavior is specified
- code visibility requirements are explicit at normal/narrow viewports
- UX differentiates proposal vs accepted code vs executing instruction
- design can be tested with Playwright
- ADR states why runtime, not AI, is execution authority.
- UX contract covers tablet landscape and portrait
- UX contract covers Studio
- code visibility rules are explicit per surface
- proposal semantics are identical across surfaces
- touch interaction references #120
- design language references #117.

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
- changed: docs/product/CROSS_SURFACE_COMPATIBILITY.md
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
- changed: extensions/vscode/src/crossSurfaceCompatibility.test.ts
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
- changed: packages/persistence/src/compatibility.ts
- changed: packages/persistence/src/index.ts
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

- docs/architecture/AI_TUTOR.md
- docs/architecture/LEARNING_COMPANION.md
- docs/architecture/SYSTEM_DESIGN.md
- docs/architecture/adr/0001-phaser-stage-renderer.md
- docs/architecture/adr/0002-open-source-license-and-governance.md
- docs/architecture/adr/0003-product-i18n-l10n.md
- AGENTS.md
- CONTRIBUTING.md
- GOVERNANCE.md
- LICENSE
- README.es.md
- README.md
- apps/tutor-api/src/index.test.ts
- apps/web/e2e/smoke.spec.ts
- apps/web/src/App.css
- apps/web/src/App.tsx
- apps/web/src/i18n.ts
- docs/delivery/IMPLEMENTATION_ORDER.md
- docs/delivery/POC_PLAN.md
- docs/product/AGORIX_STUDIO.md
- docs/product/COMPETITIVE_PRINCIPLES.md
- docs/product/CONTENT_GUIDE.md
- docs/product/CROSS_SURFACE_COMPATIBILITY.md
- docs/product/DESIGN_SYSTEM.md

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
