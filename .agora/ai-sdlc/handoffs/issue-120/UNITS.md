# Proposed Units

## UOW-120A: Interaction Contract and Documentation

Define the touch, no-drag, keyboard, virtual-keyboard and stylus-compatible interaction contract in repository artifacts.

Acceptance mapping: AC-001 through AC-008.

## UOW-120B: Web Interaction Implementation

Adjust Agorix Web where needed so Action Palette, block cards, reorder and numeric editing meet the contract without breaking #118 shell hierarchy.

Acceptance mapping: AC-001, AC-002, AC-003, AC-004, AC-006, AC-007.

## UOW-120C: Automated Interaction Verification

Add Playwright/component tests for touch/no-drag editing, reorder, orientation, numeric input and EN/ES coverage.

Acceptance mapping: AC-005, AC-007, AC-008 plus regression protection.

Execution recommendation: deliver as one PR because documentation, UI affordances and Playwright tests are tightly coupled.
