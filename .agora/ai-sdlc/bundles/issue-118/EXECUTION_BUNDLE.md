# Deterministic execution bundle

- Schema: agora-ai-sdlc/execution-bundle/v1
- Work: issue-118-delivery / issue-118
- Stage: construction
- Next action: resolve-governance-obligations
- Branch: feat/issue-118-tablet-shell
- Base: main
- HEAD: cc691378a4e1f75f5070c7eaec18cd5bc8ff96ca

## Objective

Replace the current desktop-editor-first shell with a **tablet-first learning surface** where World + Code are the two dominant persistent surfaces.

## Acceptance criteria

- tablet landscape is first-class
- tablet portrait is functional
- code remains visible/inspectable in both orientations
- World is visually primary
- controls meet touch target guidance
- orientation change preserves canonical state
- no permanent toolbox consumes major screen width
- no permanent full-height tutor panel required for normal flow
- keyboard and touch navigation both work
- Playwright covers tablet landscape + portrait.

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
- changed: docs/product/COMPETITIVE_PRINCIPLES.md
- changed: docs/product/CONTENT_GUIDE.md
- changed: docs/product/DESIGN_SYSTEM.md
- changed: docs/product/LEARNER_JOURNEY.md
- changed: docs/product/LEARNING_PROGRESSION.md
- changed: docs/product/MVP.md
- changed: docs/product/PEDAGOGY.md
- changed: docs/product/PRODUCT_INTENT.md
- changed: docs/product/TRANSLATION_GUIDE.md
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
- dirty: agora/activity.md

## Related paths

- docs/architecture/LEARNING_COMPANION.md
- docs/product/LEARNING_PROGRESSION.md
- packages/runtime/src/world.ts
- AGENTS.md
- CONTRIBUTING.md
- GOVERNANCE.md
- LICENSE
- README.es.md
- README.md
- apps/tutor-api/src/index.test.ts
- apps/web/e2e/smoke.spec.ts
- apps/web/src/App.css
- apps/web/src/App.test.tsx
- apps/web/src/App.tsx
- apps/web/src/editorModel.ts
- apps/web/src/i18n.ts
- apps/web/src/projectStorage.ts
- docs/architecture/AI_TUTOR.md
- docs/architecture/SYSTEM_DESIGN.md
- docs/architecture/adr/0001-phaser-stage-renderer.md
- docs/architecture/adr/0002-open-source-license-and-governance.md
- docs/architecture/adr/0003-product-i18n-l10n.md
- docs/delivery/IMPLEMENTATION_ORDER.md
- docs/delivery/POC_PLAN.md

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
