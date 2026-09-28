# Level 1 Plan

## L1. Confirm Responsive Shell Contract

Define the target layout contract in implementation terms:

- landscape tablet: mission chrome, World and Code as the dominant two-surface grid, contextual lower action/help band;
- portrait tablet: mission chrome, World, Code, controls, contextual action/help in scroll order;
- desktop: responsive extension of the tablet model, not a return to the permanent three-column desktop editor.

## L2. Refactor App Structure Around Persistent Surfaces

Reshape `apps/web/src/App.tsx` markup so World and Code are first-class regions with stable accessible names and testable selectors/roles. Keep existing state and behavior intact.

## L3. Replace Permanent Toolbox With Contextual Action Palette

Move block insertion from a permanent left toolbox into a contextual action palette/bottom band. Preserve add-block behavior and keyboard/touch accessibility.

## L4. Make Learning Companion Contextual

Move the tutor/Learning Companion from a permanent full-height panel into a contextual help surface near the action/evidence area. Preserve deterministic hint generation, hint history and code highlighting.

## L5. Apply #117 Visual System Tokens

Update CSS away from thick black borders and hard offset shadows toward the Agorix design system tokens, while preserving contrast, focus states and code readability.

## L6. Add Tablet and Orientation Verification

Extend Playwright to cover representative tablet landscape and portrait viewports. Verify World and Code visibility, touch target sizing, absence of permanent left toolbox dominance, and state preservation across orientation changes.

## L7. Run Deterministic Verification

Run repository web checks and targeted Playwright coverage, then register evidence before review.
