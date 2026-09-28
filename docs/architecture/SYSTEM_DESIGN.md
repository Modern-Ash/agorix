# System design

## Product architecture target

Agorix is a TypeScript-first, AI-native, multi-surface product.

Target surfaces:

- Web application / PWA.
- Android and iOS applications packaged from the web surface with Capacitor after the web vertical slice is stable.
- VS Code extension for opening and working with Agorix projects from the IDE after the core learning model is proven.

The canonical program model, runtime semantics, curriculum contracts, language projections and Learning Companion contracts are shared across surfaces.

## POC stack

- TypeScript as the primary language.
- React + Vite for the main web UI.
- Blockly as the initial block-editor adapter.
- Phaser for the 2D stage/game surface.
- PWA capabilities for installable/offline-friendly web delivery after the AI-native vertical slice is stable.
- Capacitor as the future mobile packaging/native bridge for Android/iOS.
- VS Code Extension API + Webview for the future IDE surface.
- Vitest for unit/component tests.
- Playwright for browser E2E.
- pnpm workspace/monorepo.

## Proposed repository layout

```text
apps/
  web/
  tutor-api/              # legacy name; provider adapter boundary for Learning Companion
  mobile/
extensions/
  vscode/
packages/
  program-model/
  block-editor/
  runtime/
  stage/
  curriculum/
  language-projection/      # shared projection contract and conformance helpers
  code-generator/            # current TypeScript-like projection implementation
  tutor-contract/         # legacy name; evolves into LearningCompanion contract
  provider-runtime/       # provider-neutral runtime/capability negotiation boundary
  persistence/
  platform-contract/
docs/
```

`apps/mobile` may contain Capacitor configuration/native shells while reusing the web application and shared packages rather than duplicating product logic.

## Core authority model

```text
Visual blocks
     |
     v
Canonical program --------------+
   |       |                     |
   |       v                     v
   |   LanguageProjection    Runtime
   |       |                     |
   v       v                     v
Accepted blocks/code       Runtime evidence
```

The canonical program is the source of truth. Blocks, generated text and language views are projections. Runtime evidence is the source of truth for behavior.

## AI proposal path versus runtime execution

```text
Learner intent
  -> Learning Companion
  -> ProgramProposal
  -> validation
  -> preview / diff
  -> learner accept / reject / modify
  -> canonical program mutation
```

```text
Canonical program
  -> validation
  -> deterministic runtime
  -> runtime observations
  -> visible behavior
  -> completion predicate
  -> Learning Companion explanation/debugging context
```

These are separate paths. AI proposals do not execute. Runtime execution does not depend on provider output.

## Dependency direction

```text
UI / Blockly adapter
        |
        v
  program-model
     |           |       \--> LanguageProjection --> always-visible generated code
     v
   runtime
     |
     v
    stage (Phaser adapter)

curriculum ---> program-model/runtime observations

Learning Companion contract ---> curriculum + sanitized program snapshot + runtime evidence
          |
          v
ProviderRuntime contract ---> capability negotiation + normalized provider errors
          |
          v
provider adapter boundary (local/open/remote/commercial)
```

Domain packages must not import React, Blockly, Phaser, Capacitor, VS Code APIs or provider SDKs.

## Boundaries

### program-model

Canonical, serializable AST-like representation of learner programs. It is the only mutable program authority after learner acceptance.

### block-editor

Maps visual blocks to/from program-model. Blockly-specific identifiers do not leak into domain documents.

### runtime

Executes program-model deterministically. Produces runtime observations, event order, state changes and completion facts.

### runtime evidence interface

Structured, deterministic observations consumed by UI feedback, tests and Learning Companion explanation/debugging. AI may explain evidence but may not invent it.

### stage

Framework-neutral stage state and commands. Phaser is the first renderer/adapter, not the domain authority.

### LanguageProjection

Projects canonical program state into readable Agorix Code, Python, TypeScript or future language views with stable node-to-text mappings. Language projections are display/learning surfaces unless a later explicitly approved architecture defines bidirectional editing.

### ProgramProposal

Structured proposed change produced by a human action, deterministic scaffold or Learning Companion. A proposal must validate, show what would change and wait for learner decision before canonical mutation.

### Learning Companion contract

Provider-neutral request/response model for coaching, bounded proposals, debugging, explanation, challenge and reflection. It consumes sanitized context and deterministic evidence.

### ProviderRuntime contract

Provider-neutral runtime interface for Learning Companion adapters. It describes provider/runtime identity, model id/config, supported Learning Companion capabilities, structured-output support, context limits, local/remote locality, health, timeout/cancellation and normalized errors. It must not import vendor SDKs or expose provider-specific payloads to domain contracts.

### provider adapter

Only boundary allowed to call local/open model servers, compatible gateways or commercial providers. Provider identity and SDK details stay behind this boundary; domain packages consume the ProviderRuntime contract and Learning Companion schemas only.

### tutor-api

Legacy package/app name for the provider-adapter boundary. It must behave as Learning Companion infrastructure, not as product authority.

It owns the server boundary only: environment parsing, adapter selection, `TutorRequest` <-> `LearningCompanion` mapping and deterministic degradation. Remote calls are delegated to `@agorix/provider-runtime` (`createOpenAICompatibleProviderRuntime`); it never builds HTTP requests, timeouts or wire formats itself, and it never names a provider. See `docs/providers/OPENAI_COMPATIBLE_GATEWAY.md` for the environment table and adapter guidance.

### persistence

Versioned project storage abstraction. Web starts with browser-local persistence; other surfaces can provide adapters.

### platform-contract

Small boundary for capabilities that differ across web, mobile and VS Code: filesystem access, persistence backend, sharing/export and native integrations.

## Multi-platform rules

- Shared domain logic must be platform-neutral.
- Web is the reference UI implementation for the POC.
- Mobile reuses the web product through Capacitor unless a proven UX limitation requires a native-specific component.
- VS Code reuses shared packages and may host the visual editor in a Webview.
- No surface may invent a second programming model.
- No surface may hide code visibility or proposal inspection.
- Generated text is never executed as arbitrary JavaScript.
- The product must remain usable without AI availability.

## Privacy, safety and provider rules

- No provider credentials in browser/client code.
- No provider SDKs in domain packages.
- Do not send names, emails, locations, raw long-term chat history or unrelated child data to providers.
- Provider requests use minimal mission context, sanitized canonical program snapshots, learning target, scaffold level and runtime evidence.
- Local/open model and offline/degraded paths are preferred where practical.
- Commercial providers are optional adapters.

## POC deployment

Phase 1: static web/PWA-capable app + optional local/server Learning Companion provider adapter.

Phase 2: Capacitor Android/iOS packaging over the same product after the web vertical slice is stable.

Phase 3: VS Code extension using shared packages and a Webview/editor integration after the core learning loop is proven.

No arbitrary learner code is evaluated on the server.
