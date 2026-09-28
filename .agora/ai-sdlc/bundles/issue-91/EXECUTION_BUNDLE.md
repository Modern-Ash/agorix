# Deterministic execution bundle

- Schema: agora-ai-sdlc/execution-bundle/v1
- Work: issue-91-delivery / issue-91
- Stage: construction
- Next action: resolve-governance-obligations
- Branch: ai-sdlc/issue-91
- Base: main
- HEAD: f3d970faae0cb426ef76ab5f0596deeeb2a33a6d

## Objective

Deliver the first complete Agorix experience that proves AI is integrated into the learning method without replacing the learner.

## Acceptance criteria

- full browser journey passes deterministically
- at least one learner decision is required before AI proposal application
- debugger cites/uses actual runtime facts
- Step/highlighting works in the flow
- reflection captures reasoning without gating completion
- test fails if AI can bypass acceptance
- artifacts/screenshots demonstrate the product differentiator.
- full journey passes in tablet landscape
- critical journey passes in tablet portrait
- no permanent Scratch-style toolbox is required
- World + Code remain the dominant surfaces
- interaction survives orientation/viewport change.

## Repository facts

- Languages: TypeScript, JavaScript
- Build systems: Node, pnpm
- Verification commands: pnpm test

## Changed and dirty paths

- changed: none
- dirty: none

## Related paths

- .github/workflows/ci.yml
- AGENTS.md
- README.md
- apps/mobile/README.md
- apps/tutor-api/package.json
- apps/tutor-api/src/index.ts
- apps/web/package.json
- apps/web/src/App.test.tsx
- apps/web/src/App.tsx
- docs/architecture/AI_TUTOR.md
- docs/architecture/PROGRAMMING_MODEL.md
- docs/architecture/SYSTEM_DESIGN.md
- docs/delivery/AGENTIC_DEVELOPMENT.md
- docs/delivery/AI_SDLC_SETUP.md
- docs/delivery/IMPLEMENTATION_ORDER.md
- docs/delivery/POC_PLAN.md
- docs/experiment/AI_SDLC_DOGFOOD.md
- docs/experiment/AI_SDLC_DOGFOOD_ARTICLE.md
- docs/product/COMPETITIVE_PRINCIPLES.md
- docs/product/CONTENT_GUIDE.md
- docs/product/LEARNER_JOURNEY.md
- docs/product/MVP.md
- docs/product/PEDAGOGY.md
- docs/product/PRODUCT_INTENT.md

## Mechanical risk flags

- none

## Governance

- Human approval required: False
- Missing artifacts: domain-model, logical-design, implementation-plan, test-strategy, deployment-unit
- Missing evidence: test-suite
- Missing approvals: none
- Unsatisfied criteria: source-issue

This bundle is deterministic read-only context. It does not authorize Construction, approval, review or merge.
