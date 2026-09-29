# Implementation Plan - issue #78

1. Extend the web editor with proposal review state, deterministic preview/reject/accept handlers, and localized learner copy.
2. Render a compact proposal card in the companion panel with base hash and visible diff.
3. Add styles for the proposal card without changing layout hierarchy or hiding code on tablet.
4. Add Playwright coverage for desktop, tablet portrait, and tablet landscape, asserting preview/reject/accept, canonical hash behavior, Step highlights, trace copy, Run outcome, and orientation state preservation.
5. Run format, lint, build, unit tests, E2E tests, and Agora verification.
