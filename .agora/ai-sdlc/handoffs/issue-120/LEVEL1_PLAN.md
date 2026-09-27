# Level 1 Plan

## L1. Define Interaction Contract

Document the concrete behavior for tap, long press, drag/non-drag alternatives, reorder, numeric input, orientation changes, virtual keyboard, keyboard fallback and stylus compatibility.

## L2. Strengthen Action Palette

Ensure the contextual Action Palette supports the required category model and remains available without obscuring World/Code or active editing context.

## L3. Strengthen Non-drag Editing

Ensure add, remove, reorder and numeric editing are all possible through touch/click buttons and keyboard focus, not only drag gestures.

## L4. Validate Orientation and Virtual Keyboard Safety

Prove editing state survives portrait/landscape changes and numeric input remains usable when the virtual keyboard is likely present.

## L5. Validate EN/ES Interaction

Prove the key interaction path works in English and Spanish without labels hiding required controls.

## L6. Add Automated Coverage

Extend Playwright/component tests for touch/no-drag First Mission editing, reorder, action palette context, locale and orientation behavior.

## L7. Verify and Prepare PR

Run deterministic checks, register evidence and open a PR. Do not self-merge.
