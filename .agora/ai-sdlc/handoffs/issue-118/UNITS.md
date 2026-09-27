# Proposed Units

## UOW-118A: Tablet-first shell structure

Refactor `App.tsx` markup and region semantics so mission chrome, World, Code, action palette and contextual companion are explicit first-class shell regions.

Acceptance mapping: AC-001, AC-002, AC-003, AC-004, AC-007, AC-008.

## UOW-118B: Responsive visual system implementation

Replace the current desktop-first panel grid CSS with design-system-aligned tokens, tablet landscape/portrait grids, safe-area padding, touch target sizing and virtual-keyboard-aware behavior.

Acceptance mapping: AC-001, AC-002, AC-004, AC-005, AC-008.

## UOW-118C: Tablet verification

Extend Playwright and unit tests to prove tablet landscape/portrait behavior, orientation state preservation, code visibility, action palette access, keyboard/touch access and localized layout resilience.

Acceptance mapping: AC-006, AC-009, AC-010 plus regression protection for existing behavior.

Execution recommendation: deliver these as one PR because the CSS, markup and tests are tightly coupled, but keep commits/sections reviewable by unit.
