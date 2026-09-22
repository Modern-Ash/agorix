# POC delivery plan

## Objective

Validate both Agorix and Agora AI-SDLC through one end-to-end product slice.

## Milestone 0 — governed repository

- Agora AI-SDLC installed/configured.
- Product and architecture specs versioned.
- issue-driven workflow operational.
- CI baseline.

## Milestone 1 — canonical program + runtime

- program schema/validation;
- execution semantics;
- deterministic tests.

## Milestone 2 — visual editor + stage

- Blockly adapter;
- Phaser stage adapter;
- sprite/stage;
- run/reset;
- canonical model round trip;
- persistent visual + generated-code split view.

## Milestone 3 — first mission

- mission schema;
- “Reach the goal” content;
- completion predicate;
- guided UI.

## Milestone 4 — text bridge

- program→text projection;
- synchronized read-only code panel.

## Milestone 5 — tutor

- deterministic fake tutor;
- provider-neutral contract;
- one optional LLM adapter;
- progressive hints.

## Milestone 6 — web/PWA packaging

- responsive web shell;
- PWA manifest/service-worker baseline;
- touch/mobile viewport smoke;
- shared packages contain no browser-only assumptions unless isolated behind adapters.

## Milestone 7 — POC evidence

- Playwright end-to-end;
- offline/tutor-unavailable path;
- safety/privacy checks;
- Agora artifacts/evidence/review records;
- demo script.

## Definition of POC done

A clean checkout can install, test, run and demonstrate the complete learner loop. A reviewer can trace product intent → issue → implementation → tests/evidence → review through Agora/GitHub.

## Post-POC platform validation

After the web/PWA vertical slice is stable:

1. package the same application with Capacitor for Android/iOS;
2. create a VS Code extension proof that opens an Agorix project and reuses shared packages;
3. record any portability gaps as Agora/Agorix issues rather than forking domain logic.
