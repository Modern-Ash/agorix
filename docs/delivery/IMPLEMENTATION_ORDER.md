# Recommended implementation order

This document is the default execution sequence for the Agorix proof of concept. GitHub issues remain the executable work queue.

## Phase 0 — Govern the repository

1. #32 Bootstrap Agorix with Agora AI-SDLC.
2. #29 Establish CI as early as the repository skeleton permits.
3. Begin #33 multi-agent evidence collection immediately after more than one agent is used.

Do not wait until the end to collect Agora evidence.

## Phase 1 — Product contracts

These can run mostly in parallel:
- #8 learner journey;
- #9 child-facing content;
- #10 accessibility/interaction requirements.

They must be reviewed before the main editor shell (#20) is considered complete.

## Phase 2 — Technical foundation

Recommended dependency chain:

```
#11 repository/toolchain
  |
  v
#12 canonical program
  |
  +--> #13 validation
  |
  +--> #16 text projection
  |
  v
#14 interpreter
  |
  v
#15 observations/reset
```

#12 is the key architecture contract. Do not let Blockly or React define semantics before it exists.

## Phase 3 — Visual programming

```
#17 Blockly adapter ----+
                        |
#18 block vocabulary ---+--> #20 main editor
                        |
#19 stage/runtime -------+
                        |
#16 text projection -----+
```

The main editor is not accepted unless blocks and generated code are visible simultaneously.

#21 persistence follows once the editor can serialize canonical state.

## Phase 4 — Learning experience

```
#22 mission contract
  |
  v
#23 Reach the Goal
  |
  v
#24 progress/retry/reflection
```

Mission completion must remain deterministic and independent from AI.

## Phase 5 — Tutor

```
#25 tutor contract
  |
  v
#26 deterministic fake tutor
  |
  v
#27 real LLM adapter
```

Do not start with a provider SDK. The fake tutor proves the product interaction first.

Provider/model must be configurable. Claude/OpenAI/local implementations are adapters, not domain dependencies.

## Phase 6 — Web/PWA hardening and proof

- #28 versioned persistence/migrations;
- #30 safety/security baseline;
- #36 PWA baseline;
- #31 full Playwright learner journey including narrow/mobile viewport;
- #34 Agora provenance/review/metrics exercise.

At this point the web/PWA vertical slice should be stable.

## Phase 7 — Multi-platform portability validation

- #37 package the shared web application with Capacitor for Android/iOS;
- #38 create the VS Code extension proof using shared TypeScript packages.

These issues validate portability. They must not fork the canonical program model, runtime semantics, curriculum or code-generator.

## Phase 8 — Final evidence

- #35 final demo, traceability and Agora retrospective, including explicit status/evidence for Web/PWA, Capacitor and VS Code.

## Multi-agent execution suggestion

Use different agents intentionally rather than assigning one agent to the whole project.

Example rotation:

| Work type | Producer example | Reviewer example |
| --- | --- | --- |
| Product/spec | Claude | Codex or human |
| Program model | Codex | Claude |
| Blockly/UI | Copilot or Codex | Claude/OpenCode |
| Runtime tests | OpenCode/local | Codex |
| Tutor adapter | Claude | Codex/human |
| CI/security | Codex/OpenCode | Claude/human |

This table is illustrative, not mandatory. Use only agents actually available. The purpose is to exercise Agora's portability and review separation.

## Merge discipline

An issue is not done because code exists. Expected progression:

```
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

```
Shared TypeScript contracts
   |
   +--> React/Vite + Phaser --> Web/PWA
   |                         \-> Capacitor --> Android/iOS
   |
   +--> VS Code Extension/Webview
```

The web/PWA experience is built first. Mobile and VS Code validate reuse after the canonical program, runtime and editor contracts are stable.
