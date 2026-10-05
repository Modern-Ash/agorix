# Advanced canvas proposals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. TDD per task.

**Goal:** Implement the spec. **Spec:** `docs/superpowers/specs/2026-10-05-canvas-proposals-design.md`

## Global Constraints
- Domain packages never import `vscode`. No learner text stored or logged. Works with AI off.
- Run from `agorix/`: `pnpm test`, `pnpm lint`, `pnpm -r typecheck`.

## Review Focus
- Selection that leaves the program invalid (e.g. removals without the replace) must be refused, not applied.
- Stale base hash between preview and apply.
- Empty selection produces zero transactions.
- Override out of range.
- Prediction gate also blocks "Apply selected".

## Tasks
1. Core: `selectProposalOperations`, `resolveOperationTargets` in `packages/proposals`.
2. Alternatives and evidence: `agentPort`/`agentHost` (`proposal` view with operations, evidence, alternatives; `chooseAlternative`).
3. Protocol: new fields/messages and parsing.
4. Host: `previewSelection`, `decideProposal` with `selection`.
5. UI: panel + canvas hints and ghosts.
6. Extension Host test, docs, full verification.
