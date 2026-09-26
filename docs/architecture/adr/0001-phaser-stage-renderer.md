# ADR 0001: Phaser as the first stage renderer

## Status

Accepted for the POC.

## Context

Agorix needs a visual stage for the first mission: one sprite, one goal, movement,
turning, reset and responsive rendering across web and future Capacitor mobile
surfaces. The product architecture requires shared domain logic to stay platform
neutral: no React, Phaser, Capacitor, VS Code or provider SDK imports in domain
packages.

## Decision

Use Phaser as the first 2D renderer for the web/mobile POC, behind the
`@agorix/stage` renderer boundary.

The `stage` package owns deterministic state and commands. Phaser is allowed to
render frames and handle presentation concerns, but it is not the authority for
position, orientation, collision, reset or command execution.

## Rationale

- Phaser is a mature 2D renderer with browser and mobile-web deployment history.
- The first mission is sprite-and-goal oriented, which maps directly to Phaser's
  strengths without needing a custom canvas/game loop first.
- Keeping Phaser behind a renderer interface protects the shared programming model,
  runtime and mission logic from renderer-specific APIs.
- A frame-based renderer contract is easy to test without a browser renderer.

## Renderer/domain separation

- Domain state is represented by `StageState` and changed only by `StageCommand`.
- Renderers receive immutable `StageRenderFrame` snapshots.
- Runtime observations can be converted into render frames for visual execution
  highlighting without allowing the renderer to bypass command/state contracts.
- The domain package does not import Phaser.

## Mobile and Capacitor implications

The web Phaser renderer should run inside the same React/Vite surface that
Capacitor packages for Android/iOS. Mobile-specific work should focus on layout,
input sizing and performance tuning, not a forked stage model.

## Fallback and testing strategy

- Unit tests cover stage state, collision, reset, command application and renderer
  frame generation without React, Phaser or a browser.
- A thin Phaser adapter can be tested separately with integration or browser tests.
- If Phaser is unavailable, the product can still project domain state into a
  non-Phaser renderer because the stage contract is frame-based and platform-neutral.
