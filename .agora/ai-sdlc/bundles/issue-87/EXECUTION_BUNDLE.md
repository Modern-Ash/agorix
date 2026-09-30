# Deterministic execution bundle

- Schema: agora-ai-sdlc/execution-bundle/v1
- Work: issue-87-delivery / issue-87
- Stage: operations
- Next action: resolve-governance-obligations
- Branch: ai-sdlc/issue-87
- Base: main
- HEAD: 385c7119bded2aa3a5c9a2a792306314d2cd5e43

## Objective

Create the domain protocol used whenever AI proposes a program change.

## Acceptance criteria

- stale proposal cannot apply to changed base
- unknown operation rejected
- resulting program must validate
- deterministic diff generated independently from model prose
- proposal can be serialized/audited without PII
- no provider SDK types leak into protocol
- tests cover insert/change/remove/stale/invalid
- integrates with UI boundary from #75.

## Repository facts

- Languages: TypeScript, JavaScript
- Build systems: Node, pnpm
- Verification commands: pnpm test

## Changed and dirty paths

- changed: .claude/skills/agora-flow/SKILL.md
- changed: .codex/skills/agora-flow/SKILL.md
- changed: .github/workflows/ci.yml
- changed: .gitignore
- changed: AGENTS.md
- changed: CONTRIBUTING.md
- changed: GOVERNANCE.md
- changed: LICENSE
- changed: README.es.md
- changed: README.md
- changed: apps/tutor-api/package.json
- changed: apps/tutor-api/src/index.test.ts
- changed: apps/tutor-api/src/index.ts
- changed: apps/web/e2e/smoke.spec.ts
- changed: apps/web/index.html
- changed: apps/web/package.json
- changed: apps/web/public/_headers
- changed: apps/web/public/icons/icon.svg
- changed: apps/web/public/manifest.webmanifest
- changed: apps/web/public/sw.js
- changed: apps/web/src/App.css
- changed: apps/web/src/App.test.tsx
- changed: apps/web/src/App.tsx
- changed: apps/web/src/ProvenanceLabel.test.tsx
- changed: apps/web/src/ProvenanceLabel.tsx
- changed: apps/web/src/editorModel.ts
- changed: apps/web/src/i18n.ts
- changed: apps/web/src/linkPolicy.test.ts
- changed: apps/web/src/linkPolicy.ts
- changed: apps/web/src/main.tsx
- changed: apps/web/src/manifest.test.ts
- changed: apps/web/src/projectStorage.ts
- changed: apps/web/src/registerServiceWorker.ts
- changed: apps/web/src/securityHeaders.test.ts
- changed: apps/web/src/securityHeaders.ts
- changed: apps/web/vite.config.ts
- changed: docs/architecture/AI_TUTOR.md
- changed: docs/architecture/LEARNING_COMPANION.md
- changed: docs/architecture/SYSTEM_DESIGN.md
- changed: docs/architecture/adr/0001-language-projection-contract.md
- changed: docs/architecture/adr/0001-phaser-stage-renderer.md
- changed: docs/architecture/adr/0002-open-source-license-and-governance.md
- changed: docs/architecture/adr/0003-product-i18n-l10n.md
- changed: docs/architecture/adr/0004-learning-companion-contract.md
- changed: docs/architecture/adr/0004-runtime-authority-and-observable-execution.md
- changed: docs/architecture/adr/0005-provider-runtime-contract.md
- changed: docs/delivery/IMPLEMENTATION_ORDER.md
- changed: docs/delivery/POC_PLAN.md
- changed: docs/product/AGORIX_STUDIO.md
- changed: docs/product/COMPETITIVE_PRINCIPLES.md
- changed: docs/product/CONTENT_GUIDE.md
- changed: docs/product/CROSS_SURFACE_COMPATIBILITY.md
- changed: docs/product/DESIGN_SYSTEM.md
- changed: docs/product/INTERACTION_MODEL.md
- changed: docs/product/LEARNER_JOURNEY.md
- changed: docs/product/LEARNING_EVIDENCE.md
- changed: docs/product/LEARNING_PROGRESSION.md
- changed: docs/product/MVP.md
- changed: docs/product/PEDAGOGY.md
- changed: docs/product/PRODUCT_INTENT.md
- changed: docs/product/TRANSLATION_GUIDE.md
- changed: docs/product/TRANSPARENT_PROGRAMMING_UX.md
- changed: docs/product/WORLDS.md
- changed: docs/providers/OLLAMA.md
- changed: docs/providers/OPENAI_COMPATIBLE_GATEWAY.md
- changed: docs/safety/AI_OUTPUT_VALIDATION.md
- changed: docs/safety/CHILD_SAFETY_PRIVACY.md
- changed: docs/safety/PRIVACY_THREAT_MODEL.md
- changed: docs/safety/WEB_SECURITY_BASELINE.md
- changed: eslint.config.js
- changed: extensions/vscode/README.md
- changed: extensions/vscode/package.json
- changed: extensions/vscode/src/crossSurfaceCompatibility.test.ts
- changed: extensions/vscode/src/extension.ts
- changed: extensions/vscode/src/studioCore.test.ts
- changed: extensions/vscode/src/studioCore.ts
- changed: extensions/vscode/src/vscode-shim.d.ts
- changed: extensions/vscode/tsconfig.json
- changed: extensions/vscode/vitest.config.ts
- changed: package.json
- changed: packages/block-editor/package.json
- changed: packages/block-editor/src/adapter.ts
- changed: packages/block-editor/src/changes.ts
- changed: packages/block-editor/src/index.test.ts
- changed: packages/block-editor/src/index.ts
- changed: packages/block-editor/src/vocabulary.ts
- changed: packages/code-generator/package.json
- changed: packages/code-generator/src/fixtures.ts
- changed: packages/code-generator/src/index.ts
- changed: packages/code-generator/src/project.test.ts
- changed: packages/code-generator/src/project.ts
- changed: packages/curriculum/package.json
- changed: packages/curriculum/src/index.test.ts
- changed: packages/curriculum/src/index.ts
- changed: packages/language-projection/README.md
- changed: packages/language-projection/package.json
- changed: packages/language-projection/src/conformance.ts
- changed: packages/language-projection/src/index.test.ts
- changed: packages/language-projection/src/index.ts
- changed: packages/language-projection/tsconfig.json
- changed: packages/learning-evidence/README.md
- changed: packages/learning-evidence/package.json
- changed: packages/learning-evidence/src/assessment.test.ts
- changed: packages/learning-evidence/src/assessment.ts
- changed: packages/learning-evidence/src/competencies.ts
- changed: packages/learning-evidence/src/documentation.test.ts
- changed: packages/learning-evidence/src/evidence.test.ts
- changed: packages/learning-evidence/src/evidence.ts
- changed: packages/learning-evidence/src/index.ts
- changed: packages/learning-evidence/src/synthetic-report.ts
- changed: packages/learning-evidence/tsconfig.json
- changed: packages/learning-evidence/vitest.config.ts
- changed: packages/persistence/src/compatibility.ts
- changed: packages/persistence/src/index.ts
- changed: packages/persistence/src/store.ts
- changed: packages/proposals/package.json
- changed: packages/proposals/src/index.test.ts
- changed: packages/proposals/src/index.ts
- changed: packages/proposals/tsconfig.json
- changed: packages/proposals/vitest.config.ts
- changed: packages/provider-runtime/README.md
- changed: packages/provider-runtime/package.json
- changed: packages/provider-runtime/src/index.test.ts
- changed: packages/provider-runtime/src/index.ts
- changed: packages/provider-runtime/src/selection.test.ts
- changed: packages/provider-runtime/src/selection.ts
- changed: packages/provider-runtime/tsconfig.json
- changed: packages/runtime/package.json
- changed: packages/runtime/src/errors.ts
- changed: packages/runtime/src/execute.ts
- changed: packages/runtime/src/index.test.ts
- changed: packages/runtime/src/index.ts
- changed: packages/runtime/src/operations.test.ts
- changed: packages/runtime/src/operations.ts
- changed: packages/runtime/src/world.ts
- changed: packages/stage/package.json
- changed: packages/stage/src/index.test.ts
- changed: packages/stage/src/index.ts
- changed: packages/stage/src/model.ts
- changed: packages/stage/src/rendering.ts
- changed: packages/stage/vitest.config.ts
- changed: packages/tutor-contract/README.md
- changed: packages/tutor-contract/package.json
- changed: packages/tutor-contract/src/index.test.ts
- changed: packages/tutor-contract/src/index.ts
- changed: packages/tutor-contract/src/learning-companion.ts
- changed: pnpm-lock.yaml
- changed: pnpm-workspace.yaml
- changed: scripts/security-baseline.mjs
- changed: scripts/security-baseline.test.mjs
- changed: scripts/vitest.config.ts
- changed: vitest.config.ts
- dirty: agora/activity.md
- dirty: packages/proposals/src/index.test.ts
- dirty: packages/proposals/src/index.ts

## Related paths

- packages/proposals/src/index.test.ts
- packages/proposals/src/index.ts
- packages/block-editor/src/changes.ts
- packages/proposals/package.json
- .claude/skills/agora-flow/SKILL.md
- .codex/skills/agora-flow/SKILL.md
- AGENTS.md
- CONTRIBUTING.md
- GOVERNANCE.md
- LICENSE
- README.md
- apps/tutor-api/src/index.test.ts
- apps/tutor-api/src/index.ts
- apps/web/e2e/smoke.spec.ts
- apps/web/index.html
- apps/web/package.json
- apps/web/src/App.css
- apps/web/src/App.test.tsx
- apps/web/src/App.tsx
- apps/web/src/ProvenanceLabel.tsx
- apps/web/src/editorModel.ts
- apps/web/src/i18n.ts
- apps/web/src/linkPolicy.test.ts
- apps/web/src/linkPolicy.ts

## Mechanical risk flags

- ci-configuration
- dependency-or-build-change
- security-sensitive
- source-change-without-test-change
- working-tree-dirty

## Governance

- Human approval required: False
- Missing artifacts: operational-readiness, rollback-procedure
- Missing evidence: deployment, security-scan
- Missing approvals: none
- Unsatisfied criteria: source-issue

This bundle is deterministic read-only context. It does not authorize Construction, approval, review or merge.
