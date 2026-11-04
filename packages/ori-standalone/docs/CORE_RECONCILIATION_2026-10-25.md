# Ori CORE reconciliation — 2026-10-25

## Scope
Evidence-based review of CORE epic #1 and issues #7–#10 against current repository code. No production rollout or Agorix branch changes.

## Findings
- #7 API v1: PARTIAL. `src/contracts.mjs` exposes session/proposal v0 validation; no finalized public JSON Schema v1 covering context, plan, tool-call, diff, trace, refusal, error.
- #8 Agent Loop: PARTIAL. `src/harness.mjs` implements bounded, deterministic request handling and optional hint-only provider calls. It does not implement a general iterative observe-plan-tool-verify loop, cancellation, or per-run token/time budgets.
- #9 Context Builder: PARTIAL. The harness validates input, attempt counts and tool snapshots; `src/ollama.mjs` sends minimized metadata. There is no host-neutral context builder with explicit capability/grant/snapshot provenance and budget.
- #10 Planner: PARTIAL. `planFor` emits intent-based fixed pedagogical steps, not typed adaptive plans with replanning and evidence checks.

## Existing components to reuse
- `src/tools.mjs`: allowlisted read-only tool registry and call cap.
- `src/providers.mjs`: injected providers, timeout, fallback.
- `src/ollama.mjs`: opt-in localhost Ollama adapter; not approved for children.
- `src/agorix-adapter.mjs`, `src/agorix-proposals.mjs`, `src/agorix-operations.mjs`: Agorix compatibility seams.
- `examples/shadow-api/`: loopback synthetic reference service.

## Proposed incremental implementation
1. **#7**: publish versioned host-neutral JSON schemas for context, plan, tool-call, proposal, trace evidence, refusal and errors. Keep v0 compatibility. Add positive/negative contract tests.
2. **#9**: implement pure context builder from trusted host inputs, with redaction, provenance and explicit grants. No child identity or raw messages persisted.
3. **#10**: implement typed planner with deterministic baseline and optional provider strategy; every step references permitted capabilities and learning goals.
4. **#8**: build bounded state machine observe → plan → authorized tool → verify → respond; cap steps/calls/time, support cancellation, never auto-apply, never invent runtime evidence.
5. Add synthetic end-to-end CLI demonstration, negative/adversarial tests and CI; update stale README status.

## Architecture
Ori owns agent orchestration, pedagogical policies and provider interfaces. Hosts own project persistence, canonical runtime, authoritative verification and learner approval. Agorix is the first client, not the only one.

## Safety / integration gates
- No shell, git, arbitrary filesystem/network or automatic edits in Kids profile.
- All model output is untrusted and schema validated.
- Keep Agorix experiments exclusively on `integration/ori`; never target Agorix `main` or `develop`.
- No child-facing deployment until explicit security, privacy and educator review.
- CI and human review required before merge.

## Traceability
Epic #1; #7 #8 #9 #10; provider #11 #13; tools #15 #17; Agorix integration epic #722.
