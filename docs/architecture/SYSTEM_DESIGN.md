# System design

## POC stack

- TypeScript.
- React + Vite for web UI.
- Blockly as the initial block-editor adapter.
- Canvas rendering through a thin stage abstraction; Phaser is preferred if collision/game-loop needs justify it, otherwise use a minimal Canvas implementation.
- Vitest for unit/component tests.
- Playwright for browser E2E.
- pnpm workspace/monorepo.

## Proposed repository layout

```
apps/
  web/
  tutor-api/
packages/
  program-model/
  block-editor/
  runtime/
  stage/
  curriculum/
  tutor-contract/
  persistence/
docs/
```

The POC may initially run tutor-api as a small local Node service.

## Dependency direction

```
UI / Blockly adapter
        |
        v
  program-model
        |
        v
     runtime
        |
        v
      stage

curriculum ---> program-model/runtime observations

AI tutor ---> tutor-contract ---> curriculum + sanitized program snapshot
```

Domain packages must not import React, Blockly or provider SDKs.

## Boundaries

### program-model
Canonical, serializable AST-like representation of learner programs.

### block-editor
Maps visual blocks to/from program-model. Blockly-specific identifiers do not leak into domain documents.

### runtime
Executes program-model deterministically. Produces events/observations.

### stage
Sprite state and rendering boundary.

### curriculum
Mission definitions, completion predicates, hint ladders.

### tutor-contract
Provider-neutral request/response model and pedagogical guardrails.

### tutor-api
Only component allowed to call an external LLM provider.

### persistence
Versioned local project storage.

## POC deployment

Static web + optional local/server API for tutor. No arbitrary learner code is evaluated on the server.
