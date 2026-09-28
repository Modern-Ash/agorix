# Recommended implementation order

This document is the durable execution sequence for the Agorix proof of concept. GitHub issues remain the executable work queue. Issue #106 was the temporary operational map; this document reconciles that map into source control.

## North star

> AI proposes. Child decides. Runtime proves. Child explains.

> Nothing happens under the rug.

## Dependency diagram

```text
Wave 0: source of truth
  #69 product/pedagogy/journey
    -> #70 learner progression/scaffolding
      -> #71 MVP/competitive/order
        -> #72 architecture and agent invariants
        -> #73 OSS governance when decision is available
        -> #110 multilingual product/i18n foundation

Wave 1: contracts
  #74 transparency UX/ADR
  #79 LanguageProjection contract
  #85 LearningCompanion contract
  #92 provider-neutral runtime contract
  #99 AI provenance UX
  #102 learning evidence model
  #103 privacy threat model
  #110 i18n/learning companion architecture

Wave 2: safe foundations
  #75 proposal preview/diff
  #76 step + synchronized highlighting
  #77 child-readable execution trace
  #80 Agorix Code
  #81 Python projection
  #82 TypeScript projection migration
  #86 intent-to-plan
  #87 ProgramProposal protocol
  #89 explainer/challenger/reflector
  #90 scaffolding policy
  #93 Ollama adapter
  #94 OpenAI-compatible gateway
  #95 optional commercial adapters
  #100 AI output/safety validation

Wave 3: integration
  #83 language selector/comparison
  #88 evidence-grounded debugger
  #96 provider selection/fallback/offline mode
  #101 model-comparison learning activity
  #30 web-security baseline aligned with #100/#103

Wave 4: product gates
  #78 transparency E2E
  #91 complete AI-native First Mission E2E
  #104 AI-literacy E2E

Wave 5: openness, conformance and evidence
  #84 language-pack model + Lua spike
  #97 multi-provider conformance matrix
  #98 self-hosting guide
  #33 multi-agent delivery evidence
  #34 Agora provenance/review evidence
  #35 final AI-native demo + retrospective

Deferred platform validation
  #36 PWA baseline
  #37 Capacitor Android/iOS proof
  #38 VS Code extension proof
```

## Wave 0 - Product source of truth

Complete this wave before implementation agents reinterpret legacy optional-tutor language.

Recommended order:

```text
#69 -> #70 -> #71 -> #72
                 \
                  -> #73 once governance decision is available
                  -> #110 after product/i18n direction is stable
```

Status and purpose:

- #69 revises product intent, pedagogy and learner journey around the AI-native north star.
- #70 defines concept-based progression and adaptive scaffolding.
- #71 revises MVP, competitive principles, implementation order and POC plan.
- #72 must align AGENTS and architecture invariants with the new source of truth.
- #73 must make the open-source license/governance decision explicitly.
- #110 extends product and architecture direction for multilingual UI/curriculum/learning companion work.

## Wave 1 - Architecture contracts

These may proceed in parallel after the relevant Wave 0 source of truth exists, but they must not mutate the same contract concurrently.

- #74 transparent construction/execution UX plus "nothing under the rug" ADR.
- #79 LanguageProjection contract and canonical node-to-text mapping.
- #85 provider-neutral LearningCompanion capability contract.
- #92 provider-neutral LLM runtime and capability negotiation contract.
- #99 child-facing AI provenance, uncertainty and suggestion-state UX.
- #102 learning evidence model for programming plus AI literacy.
- #103 privacy and data-minimization threat model for local/remote AI modes.
- #110 multilingual UI/curriculum/Learning Companion architecture.

## Wave 2 - Safe foundational implementation

### Transparency

- #75 proposal preview, diff and learner acceptance boundary.
- #76 step execution with synchronized block and code highlighting.
- #77 child-readable execution trace and state-change visualization.

### Languages

- #80 Agorix Code as the first learner-friendly textual projection.
- #81 deterministic Python projection.
- #82 TypeScript generator migration into the LanguageProjection architecture.

### Learning companion

- #86 intent-to-plan learning dialogue.
- #87 structured ProgramProposal protocol.
- #89 Explainer, Challenger and Reflector roles.
- #90 adaptive scaffolding and anti-over-assistance policy.

### Providers and safety

- #93 Ollama local-model adapter.
- #94 OpenAI-compatible gateway adapter for local/open inference servers.
- #95 optional commercial-provider adapter migration.
- #100 structured AI-output validation and child-safety policy enforcement.

Parallelism is allowed only when declared dependencies are satisfied.

## Wave 3 - Integration

- #83 language selector and cross-language comparison.
- #88 evidence-grounded AI debugger using deterministic runtime observations.
- #96 provider selection, capability fallback and meaningful offline mode.
- #101 model-comparison learning activity focused on evidence.
- #30 core web-security baseline aligned with #100 and #103.

## Wave 4 - Product gates

- #78 transparency E2E proving no hidden mutation and observable execution.
- #91 complete AI-native First Mission E2E.
- #104 AI-literacy E2E: inspect, test, challenge and correct an AI proposal.

These tests are product gates, not optional polish. They should fail if:

- AI mutates code invisibly;
- code disappears during the flow;
- AI claims replace runtime evidence;
- learner decision can be bypassed.

## Wave 5 - Openness, conformance and evidence

- #84 language-pack extension model and Lua projection spike.
- #97 multi-provider conformance matrix and contract test suite.
- #98 self-hosting and open-source-first deployment guide.
- #33 multi-agent delivery evidence.
- #34 Agora provenance/review evidence.
- #35 final AI-native demo and retrospective.

## Deferred platform validation

These remain useful but must not steal priority from the learning model:

- #36 PWA baseline;
- #37 Android/iOS via Capacitor;
- #38 VS Code extension.

Re-evaluate them after #91 proves the complete AI-native First Mission. They must reuse the canonical program, runtime semantics, curriculum contracts and learning-companion protocols.

## Legacy and new issue reconciliation

| Issue(s) | Disposition                  | Rationale                                                                                                            |
| -------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| #1       | preserve                     | Historical product foundation retained as context.                                                                   |
| #2       | preserve / extend            | Canonical program and runtime remain foundational; later transparency/runtime evidence work extends them.            |
| #3       | preserve / extend            | Visual editor and block/code bridge remain foundational; code visibility and proposal boundaries extend them.        |
| #4       | preserve / extend            | First guided mission remains the POC mission; AI-native loop and evidence gates extend it.                           |
| #5       | supersede                    | Optional AI Tutor epic is replaced by #66, #67 and #68.                                                              |
| #8       | supersede / preserve context | Older learner journey is superseded by #69 while useful layout constraints remain context.                           |
| #9       | preserve / extend            | Child-facing content should align with #69/#70 progression and #68 AI literacy.                                      |
| #10      | preserve / extend            | Accessibility/interaction requirements remain valid and must support visible code/proposal surfaces.                 |
| #11-#16  | preserve                     | Repository, program model, validation, runtime, observations/reset and text projection remain the technical base.    |
| #17-#21  | preserve / extend            | Blockly, blocks, stage/editor/persistence remain required; #64-#66 extend their transparency and AI-native behavior. |
| #22-#24  | preserve / extend            | Mission/progress/reflection remain required; #70/#102 refine learning evidence.                                      |
| #25-#27  | extend / supersede naming    | Existing tutor contracts and adapters are migrated into the LearningCompanion and provider-neutral architecture.     |
| #28      | preserve                     | Versioned persistence remains required.                                                                              |
| #29      | preserve                     | CI remains foundational.                                                                                             |
| #30      | extend                       | Security baseline must align with AI-output validation and privacy threat model.                                     |
| #31      | supersede                    | Old learner-journey E2E is replaced by #78, #91 and #104.                                                            |
| #32      | preserve                     | Agora AI-SDLC bootstrap remains repository governance foundation.                                                    |
| #33-#35  | preserve / defer to Wave 5   | Evidence, provenance and final demo remain required after the AI-native slice is demonstrable.                       |
| #36-#38  | defer                        | PWA, Capacitor and VS Code proofs are deferred until the core web vertical slice is stable.                          |
| #64      | extend                       | Transparency epic becomes a core product gate.                                                                       |
| #65      | extend                       | Multi-language work is staged after LanguageProjection contracts.                                                    |
| #66      | extend                       | Learning companion replaces optional tutor mental model.                                                             |
| #67      | extend                       | Provider-neutral/local-open architecture becomes roadmap requirement.                                                |
| #68      | extend                       | AI literacy and child safety become learning outcomes and E2E gates.                                                 |
| #69-#72  | preserve                     | Wave 0 source-of-truth sequence.                                                                                     |
| #73      | defer until decision         | License/governance must be explicit before claiming open-source governance completion.                               |
| #74-#104 | preserve                     | AI-native backlog implementing #64-#68.                                                                              |
| #106     | retire after #71             | Temporary execution map is reconciled into this document.                                                            |
| #110     | preserve / stage             | Multilingual product/i18n work proceeds after #69 and must align with #71/#72.                                       |

## Agora Flow execution

Default single-issue workflow:

```bash
aisdlc start --issue <number> --agent <runtime>
```

The executor must:

1. read the issue and referenced specs;
2. obey dependencies;
3. not depend on private chat context;
4. produce required artifacts/evidence;
5. test deterministic paths;
6. open a linked PR;
7. receive independent review;
8. never self-merge.

## Parallel execution rule

Before running work in parallel, verify that issues do not mutate the same source-of-truth contract concurrently.

Safe parallelism is usually across separate contracts after parent decisions are stable. Unsafe parallelism includes implementing provider adapters before #92 defines the provider runtime contract, or implementing proposal UX before #74/#87 define the boundary.

## Merge discipline

An issue is not done because code exists. Expected progression:

```text
issue
  -> required artifact/spec
  -> implementation
  -> deterministic tests
  -> CI evidence
  -> independent review
  -> merge
  -> Agora evidence/provenance where applicable
```

No agent self-merges.

## Platform strategy summary

TypeScript is the primary product language across Agorix.

```text
Shared TypeScript contracts
   |
   +--> React/Vite + Phaser --> Web/PWA
   |                         \-> Capacitor --> Android/iOS
   |
   +--> VS Code Extension/Webview
```

The web/PWA experience is built first. Mobile and VS Code validate reuse after the canonical program, runtime, editor contracts and AI-native learner loop are stable.
