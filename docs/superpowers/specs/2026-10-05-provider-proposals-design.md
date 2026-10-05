# Provider-backed proposals (design)

Sub-project 3 of the Studio "powerization" remainder. Date: 2026-10-05.

## Goal

Both the Companion "build" action and the Workbench agent loop obtain proposals through one seam that consults the Studio decision pipeline (System 0 / LAYA / budget / local-first) and, when allowed, a provider; the result is a normal `ProgramProposal` reviewed by the learner.

## Success criteria

- Nothing from a provider reaches the program without validation, diff and a learner decision.
- Studio works unchanged with AI off, offline or without credentials: every failure degrades to the built-in deterministic proposal with a short learner notice.
- A request budget is respected; telemetry carries enums and numbers only, never free text.
- Deterministic tests with a fake fetch and the real pipeline.

## Design

1. **`studioProposalSource.ts`** (no `vscode`). `request(task, project)`: build the Builder `LearningCompanionRequest`; `pipeline.decide` with a `first-step` / `repeat-pattern` signal and the program hash; if the provider request is not allowed, return the built-in proposal with the pipeline's `learnerNotice`; otherwise `client.request`. A valid builder response whose `baseProgramHash` matches the current program becomes a session via `createProposalSession`. `unavailable`, `rejected`, invalid or stale all fall back to built-in with a notice. Result: `{ origin: "provider" | "built-in", session, notice? }`.
2. **Pipeline in production.** `createStudioPipeline` with LAYA (`createLayaLearningProvider`) when `layaEndpoint` is set and a synchronous policy router (AI agreements, remote opt-in, configured endpoints); real health is checked by `client.request`. New setting `agorixStudio.agent.proposalBudgetRequests` (default 10); the pipeline is recreated when configuration changes.
3. **Surfaces.** `AgentPort.proposeFor` and the host's request path become async. When the provider answers it is the primary proposal and the built-in one becomes the alternative ("Built-in suggestion, no AI") with runtime evidence (reuses sub-project 2). `createCompanionTurn` accepts an already validated `providerResponse`; `providerSelection` gains `"provider"`.
4. **Protocol/UI.** `proposal` gains `origin` and `notice`; the panel labels "AI suggestion" or "Built-in suggestion" and shows the notice.
5. **Errors.** Contract/safety validation happens in the client; then proposal validation and base-hash freshness. Without network or credentials behaviour is today's.

## Out of scope

Mission Spec editing and distribution (sub-project 6).
