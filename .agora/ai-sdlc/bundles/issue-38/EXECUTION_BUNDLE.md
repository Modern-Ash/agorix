# Deterministic execution bundle

- Schema: agora-ai-sdlc/execution-bundle/v1
- Work: issue-38-delivery / issue-38
- Stage: construction
- Next action: resolve-governance-obligations
- Branch: feat/issue-38-agorix-studio
- Base: main
- HEAD: 85295977bd9db08cf15a7c461de21dcda4b9f6b1

## Objective

Build Agorix Studio — VS Code learning and creation environment

## Acceptance criteria

- extension builds/packages
- opens same project semantics as Web
- active node maps correctly to editor range
- Step updates code + World Preview + inspector consistently
- ProgramProposal can be inspected/rejected/applied explicitly
- no silent mutation
- Web-created fixture opens in Studio
- Studio-modified canonical fixture reopens in Web via #121
- visual language follows #117.

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
- changed: docs/product/INTERACTION_MODEL.md
- changed: docs/product/LEARNER_JOURNEY.md
- changed: docs/product/LEARNING_PROGRESSION.md
- changed: docs/product/MVP.md
- changed: docs/product/PEDAGOGY.md
- changed: docs/product/PRODUCT_INTENT.md
- changed: docs/product/TRANSLATION_GUIDE.md
- changed: docs/product/WORLDS.md
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

- packages/code-generator/src/fixtures.ts
- docs/architecture/LEARNING_COMPANION.md
- docs/product/LEARNING_PROGRESSION.md
- packages/block-editor/package.json
- packages/block-editor/src/adapter.ts
- packages/block-editor/src/changes.ts
- packages/block-editor/src/index.test.ts
- packages/block-editor/src/index.ts
- packages/curriculum/package.json
- packages/curriculum/src/index.test.ts
- packages/curriculum/src/index.ts
- packages/persistence/src/store.ts
- packages/runtime/package.json
- packages/runtime/src/execute.ts
- packages/runtime/src/index.test.ts
- packages/runtime/src/index.ts
- packages/stage/package.json
- packages/stage/src/index.test.ts
- packages/stage/src/index.ts
- packages/stage/src/rendering.ts
- packages/tutor-contract/package.json
- packages/tutor-contract/src/index.test.ts
- packages/tutor-contract/src/index.ts
- AGENTS.md

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
