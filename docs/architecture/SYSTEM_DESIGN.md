# System design

## Product architecture target

Agorix is a TypeScript-first, multi-surface product.

Target surfaces:

- Web application / PWA.
- Android and iOS applications packaged from the web surface with Capacitor.
- VS Code extension for opening and working with Agorix projects from the IDE.

The canonical program model, runtime semantics, curriculum contracts, generated-code projection and tutor contracts are shared across surfaces.

## POC stack

- TypeScript as the primary language.
- React + Vite for the main web UI.
- Blockly as the initial block-editor adapter.
- Phaser for the 2D stage/game surface.
- PWA capabilities for installable/offline-friendly web delivery.
- Capacitor as the mobile packaging/native bridge for Android/iOS.
- VS Code Extension API + Webview for the future IDE surface.
- Vitest for unit/component tests.
- Playwright for browser E2E.
- pnpm workspace/monorepo.

## Proposed repository layout

```
apps/
  web/
  tutor-api/
  mobile/
extensions/
  vscode/
packages/
  program-model/
  block-editor/
  runtime/
  stage/
  curriculum/
  code-generator/
  tutor-contract/
  persistence/
  platform-contract/
docs/
```

`apps/mobile` may contain Capacitor configuration/native shells while reusing the web application and shared packages rather than duplicating product logic.

## Surface model

```
                         Shared TypeScript packages
                                   |
           +-----------------------+-----------------------+
           |                       |                       |
           v                       v                       v
        Web/PWA              Android / iOS             VS Code
      React + Vite             Capacitor            Extension/Webview
           |                       |                       |
           +-----------------------+-----------------------+
                                   |
                              program-model
                              runtime
                              curriculum
                              code-generator
```

## Dependency direction

```
UI / Blockly adapter
        |
        v
  program-model
     |      \
     |       \--> code-generator --> always-visible generated code
     v
   runtime
     |
     v
    stage (Phaser adapter)

curriculum ---> program-model/runtime observations

AI tutor ---> tutor-contract ---> curriculum + sanitized program snapshot
```

Domain packages must not import React, Blockly, Phaser, Capacitor, VS Code APIs or provider SDKs.

## Boundaries

### program-model

Canonical, serializable AST-like representation of learner programs.

### block-editor

Maps visual blocks to/from program-model. Blockly-specific identifiers do not leak into domain documents.

### runtime

Executes program-model deterministically. Produces events/observations.

### stage

Framework-neutral stage state and commands. Phaser is the first renderer/adapter, not the domain authority.

### code-generator

Projects canonical program state into readable TypeScript/JavaScript-like code and node→text mappings.

### curriculum

Mission definitions, completion predicates and hint ladders.

### tutor-contract

Provider-neutral request/response model and pedagogical guardrails.

### tutor-api

Only component allowed to call an external LLM provider.

### persistence

Versioned project storage abstraction. Web starts with browser-local persistence; other surfaces can provide adapters.

### platform-contract

Small boundary for capabilities that differ across web, mobile and VS Code: filesystem access, persistence backend, sharing/export, native integrations.

## Multi-platform rules

- Shared domain logic must be platform-neutral.
- Web is the reference UI implementation for the POC.
- Mobile reuses the web product through Capacitor unless a proven UX limitation requires a native-specific component.
- VS Code reuses shared packages and may host the visual editor in a Webview.
- No surface may invent a second programming model.
- Generated text is never executed as arbitrary JavaScript.
- The product must remain usable without AI availability.

## POC deployment

Phase 1: static web/PWA + optional local/server tutor API.

Phase 2: Capacitor Android/iOS packaging over the same product.

Phase 3: VS Code extension using shared packages and a Webview/editor integration.

No arbitrary learner code is evaluated on the server.
