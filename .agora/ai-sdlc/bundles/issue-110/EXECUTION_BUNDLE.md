# Deterministic execution bundle

- Schema: agora-ai-sdlc/execution-bundle/v1
- Work: issue-110-delivery / issue-110
- Stage: construction
- Next action: resolve-governance-obligations
- Branch: unknown
- Base: main
- HEAD: c6629cb17a46e5bc574374abc21e959074178896

## Objective

Make Agorix a **multilingual learning product** so children can use the platform, missions, feedback and AI Learning Companion in their own language without changing programming semantics or creating locale-specific forks.

## Acceptance criteria

- English and Spanish are both selectable in the application
- switching locale does not change canonical program hash/semantics
- First Mission is complete in both locales
- Run/Step/Stop/Reset, proposal review and execution evidence are localized
- deterministic fake Learning Companion works in both locales
- real-provider requests carry locale explicitly
- AI structured fields remain locale-independent
- safety-critical copy exists and is reviewed in both locales
- no core learner-facing UI strings are hard-coded outside localization resources
- locale fallback is deterministic and tested
- missing translation keys fail CI or produce an explicit developer diagnostic
- adding a third locale does not require changing canonical program/runtime code
- README.md and README.es.md provide equivalent product information.

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
- changed: apps/web/src/projectStorage.ts
- changed: docs/architecture/AI_TUTOR.md
- changed: docs/architecture/LEARNING_COMPANION.md
- changed: docs/architecture/SYSTEM_DESIGN.md
- changed: docs/architecture/adr/0001-phaser-stage-renderer.md
- changed: docs/architecture/adr/0002-open-source-license-and-governance.md
- changed: docs/delivery/IMPLEMENTATION_ORDER.md
- changed: docs/delivery/POC_PLAN.md
- changed: docs/product/COMPETITIVE_PRINCIPLES.md
- changed: docs/product/CONTENT_GUIDE.md
- changed: docs/product/LEARNER_JOURNEY.md
- changed: docs/product/LEARNING_PROGRESSION.md
- changed: docs/product/MVP.md
- changed: docs/product/PEDAGOGY.md
- changed: docs/product/PRODUCT_INTENT.md
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
- docs/product/COMPETITIVE_PRINCIPLES.md
- docs/product/CONTENT_GUIDE.md
- docs/product/LEARNER_JOURNEY.md
- docs/product/MVP.md
- docs/product/PEDAGOGY.md
- docs/product/PRODUCT_INTENT.md
- AGENTS.md
- CONTRIBUTING.md
- GOVERNANCE.md
- LICENSE
- README.es.md
- README.md
- apps/tutor-api/src/index.test.ts
- apps/tutor-api/src/index.ts
- apps/web/e2e/smoke.spec.ts
- apps/web/package.json
- apps/web/src/App.test.tsx
- apps/web/src/App.tsx
- apps/web/src/editorModel.ts
- apps/web/src/projectStorage.ts
- docs/architecture/AI_TUTOR.md
- docs/architecture/SYSTEM_DESIGN.md

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
