# Suggested Bolts

## Bolt 1: Shell map and semantic regions

- Confirm final region names and accessible landmarks.
- Introduce World/Code dominant shell markup while preserving existing handlers and state.
- Keep tests green at the component level.

Depends on: approved inception.

## Bolt 2: Contextual Action Palette and Companion

- Move block insertion into an Action Palette/bottom band.
- Convert tutor panel to contextual Learning Companion surface.
- Preserve existing add-block and deterministic hint behavior.

Depends on: Bolt 1.

## Bolt 3: Responsive CSS and design tokens

- Add Agorix semantic CSS tokens.
- Implement tablet landscape, tablet portrait and desktop responsive rules.
- Ensure touch targets, focus, safe-area padding and no overlap.

Depends on: Bolt 1 and Bolt 2.

## Bolt 4: Verification and evidence

- Add Playwright tablet landscape/portrait tests.
- Add orientation/state preservation test.
- Run format, unit and e2e checks.
- Register evidence and prepare PR.

Depends on: Bolt 3.
