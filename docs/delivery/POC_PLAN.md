# POC delivery plan

## Objective

Validate both Agorix and Agora AI-SDLC through one end-to-end AI-native product slice:

> AI proposes. Child decides. Runtime proves. Child explains.

## Milestone 0 - Governed repository and source of truth

- Agora AI-SDLC installed/configured.
- Product and architecture specs versioned.
- Issue-driven workflow operational.
- CI baseline.
- #69, #70 and #71 source-of-truth documents accepted.
- #72 architecture and agent invariants aligned before broad implementation resumes.

## Milestone 1 - Canonical program + runtime

- Program schema/validation.
- Execution semantics.
- Deterministic runtime observations.
- Reset/stop/run state.
- Tests proving runtime evidence, not AI judgment, determines behavior.

## Milestone 2 - Visual editor + always-visible code

- Blockly adapter.
- Phaser stage adapter.
- Sprite/stage.
- Run/stop/reset controls.
- Canonical model round trip.
- Persistent visual + generated-code split view.
- Generated code remains visible during normal editing on desktop and narrow/mobile viewports.

## Milestone 3 - First Mission

- Mission schema.
- "Reach the goal" content.
- Deterministic completion predicate.
- Prediction prompt where appropriate.
- Behavior-specific feedback.
- Reflection prompt that supports learning evidence without blocking basic completion.

## Milestone 4 - Transparent proposal and learner decision boundary

- Learning-companion proposal protocol.
- Proposal preview/diff.
- Learner accept/reject/modify controls.
- Accepted program mutates only after learner decision.
- Rejected proposals leave canonical program unchanged.
- AI-disabled path remains usable.

## Milestone 5 - Evidence-grounded debugging

- Runtime observations available to feedback and learning-companion logic.
- Debugging support points to accepted program, visible code and runtime facts.
- AI may explain or propose a bounded next step, but may not claim unobserved behavior.
- Learner can correct the program and re-run.

## Milestone 6 - Local/open and provider-neutral learning companion

- Deterministic fake/local path for product interaction tests.
- Provider-neutral LearningCompanion contract.
- Local/open model configuration where hardware/environment permits.
- Optional remote/commercial provider adapters behind the same contract.
- Meaningful offline or AI-unavailable learning path.

## Milestone 7 - Web/PWA hardening

- Responsive web shell.
- PWA manifest/service-worker baseline after the vertical slice is stable.
- Touch/mobile viewport smoke.
- Shared packages contain no browser-only assumptions unless isolated behind adapters.
- Safety/privacy checks aligned with local and remote AI modes.

## Milestone 8 - POC evidence gates

- Playwright end-to-end for complete AI-native First Mission.
- Transparency E2E proving no hidden AI mutation.
- AI-literacy E2E proving a learner can inspect, test, challenge and correct an AI proposal.
- Offline/tutor-unavailable path.
- Safety/privacy checks.
- Agora artifacts/evidence/review records.
- Demo script.

## Definition of POC done

A clean checkout can install, test, run and demonstrate the complete learner loop. A reviewer can trace product intent -> issue -> implementation -> tests/evidence -> review through Agora/GitHub.

The POC is not done if:

- a hidden AI-generated solution can count as success;
- generated code disappears from the normal flow;
- mission completion depends on an LLM judgment;
- provider credentials or child PII are required;
- platform packaging works but the AI-native learner loop does not.

## Post-POC platform validation

After the web/PWA vertical slice and product gates are stable:

1. package the same application with Capacitor for Android/iOS;
2. create a VS Code extension proof that opens an Agorix project and reuses shared packages;
3. record any portability gaps as Agora/Agorix issues rather than forking domain logic.
