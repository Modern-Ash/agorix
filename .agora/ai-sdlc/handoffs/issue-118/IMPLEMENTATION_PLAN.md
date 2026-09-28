# Implementation Plan

1. Add a manual Step handler to `apps/web/src/App.tsx` using existing runtime observations.
2. Refactor shell markup to rename the permanent toolbox into a contextual Action Palette and move it below the primary World/Code surfaces.
3. Rename the tutor panel to contextual Learning Companion semantics while preserving deterministic hint behavior.
4. Rework `apps/web/src/App.css` with Agorix design-system tokens, tablet-first named grid areas, safe-area padding, touch target sizing and non-hover focus/active states.
5. Add i18n labels needed by the new shell.
6. Extend Playwright coverage for tablet landscape, tablet portrait, touch target sizing, no permanent left toolbox and orientation state preservation.
7. Run format, unit tests, build and Playwright before evidence registration.
